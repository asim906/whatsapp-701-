import makeWASocket, { 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    WASocket,
    proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { processIncomingMessage } from './messageHandler.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { Server } from 'socket.io';

// ESM __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { adminDb } from '../config/firebase-admin.js';

// We store sessions per user
const sessionsDir = path.join(__dirname, '../../sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Simple in-memory message store (replaces makeInMemoryStore which was removed in Baileys v7)
export type MessageStore = {
    [jid: string]: proto.IWebMessageInfo[]
};

export type ChatStore = {
    [jid: string]: {
        id: string;
        name?: string;
        lastMessage?: string;
        lastMessageTime?: string;
        unreadCount: number;
    }
};

export const messageStores: { [userId: string]: MessageStore } = {};
export const chatStores: { [userId: string]: ChatStore } = {};
export const activeSockets: { [userId: string]: WASocket } = {};

export const initializeWhatsApp = async (userId: string, io: Server) => {
    // DO NOT emit whatsapp_ready here. Only emit it when connection is truly OPEN.
    const sessionPath = path.join(sessionsDir, `session_${userId}`);
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`[${userId}] Initializing WA v${version.join('.')}, isLatest: ${isLatest}`);

    // Initialize our own stores for this user
    if (!messageStores[userId]) messageStores[userId] = {};
    if (!chatStores[userId]) chatStores[userId] = {};

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }) as any,
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        getMessage: async (key) => {
            const jid = key.remoteJid!;
            const msgs = messageStores[userId]?.[jid] || [];
            return msgs.find(m => m.key.id === key.id)?.message || undefined;
        }
    });

    activeSockets[userId] = sock;
    sock.ev.on('creds.update', saveCreds);

    // Initial history sync
    sock.ev.on('messaging-history.set', ({ chats, messages }) => {
        console.log(`[${userId}] 📚 Initial history received: ${chats?.length} chats, ${messages?.length} messages`);
        
        if (chats) {
            for (const chat of chats) {
                if (!chatStores[userId][chat.id]) {
                    chatStores[userId][chat.id] = {
                        id: chat.id,
                        name: chat.name || undefined,
                        unreadCount: chat.unreadCount || 0,
                        lastMessage: undefined,
                        lastMessageTime: undefined
                    };
                }
            }
        }

        if (messages) {
            for (const msg of messages) {
                const jid = msg.key.remoteJid!;
                if (!jid) continue;

                if (!messageStores[userId][jid]) messageStores[userId][jid] = [];
                messageStores[userId][jid].push(msg);
                
                // Update last message in chatStore
                if (chatStores[userId][jid]) {
                    const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? 'photo' : '');
                    if (content) {
                        const msgTime = new Date((msg.messageTimestamp as number) * 1000).toISOString();
                        if (!chatStores[userId][jid].lastMessageTime || msgTime > chatStores[userId][jid].lastMessageTime!) {
                            chatStores[userId][jid].lastMessage = content;
                            chatStores[userId][jid].lastMessageTime = msgTime;
                        }
                    }
                }
            }
        }
    });

    sock.ev.on('chats.upsert', (newChats) => {
        for (const chat of newChats) {
            if (!chatStores[userId][chat.id]) {
                chatStores[userId][chat.id] = {
                    id: chat.id,
                    name: chat.name || undefined,
                    unreadCount: chat.unreadCount || 0,
                    lastMessage: undefined,
                    lastMessageTime: undefined
                };
            }
        }
    });

    sock.ev.on('chats.update', (updates) => {
        for (const update of updates) {
            if (update.id && chatStores[userId][update.id]) {
                const existing = chatStores[userId][update.id];
                chatStores[userId][update.id] = {
                    ...existing,
                    name: update.name || existing.name,
                    unreadCount: update.unreadCount !== undefined ? update.unreadCount : existing.unreadCount
                };
            }
        }
    });

    // Manually maintain a rolling 30-message history per chat
    sock.ev.on('messages.upsert', async (m) => {
        if (!messageStores[userId]) messageStores[userId] = {};
        
        for (const msg of m.messages) {
            const jid = msg.key.remoteJid!;
            if (!messageStores[userId][jid]) {
                messageStores[userId][jid] = [];
            }
            // Rolling 30-message window
            messageStores[userId][jid].push(msg);
            if (messageStores[userId][jid].length > 30) {
                messageStores[userId][jid].shift();
            }

            // Update chat list info
            if (!chatStores[userId][jid]) {
                chatStores[userId][jid] = { id: jid, unreadCount: 0 };
            }
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? 'photo' : '');
            if (content) {
                chatStores[userId][jid].lastMessage = content;
                chatStores[userId][jid].lastMessageTime = new Date().toISOString();
            }

            // Process only incoming messages
            if (m.type === 'notify' && !msg.key.fromMe) {
                console.log(`[${userId}] Received message from ${msg.key.remoteJid}`);
                chatStores[userId][jid].unreadCount += 1;
                
                // Track analytics
                await AnalyticsService.trackEvent(userId, 'messages');
                await processIncomingMessage(userId, msg, sock, io);
            }
        }
    });

    let qrCount = 0;
    const MAX_QR_RETRIES = 3;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCount++;
            console.log(`[${userId}] QR generated (${qrCount}/${MAX_QR_RETRIES}) — emitting to frontend`);
            
            if (qrCount > MAX_QR_RETRIES) {
                console.log(`[${userId}] ⚠️ QR generation limit reached. Expiring session.`);
                sock.logout(); // This will trigger connection 'close'
                io.to(`user_${userId}`).emit('whatsapp_qr_expired');
                return;
            }
            
            io.to(`user_${userId}`).emit('whatsapp_qr', { qr });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && qrCount <= MAX_QR_RETRIES;
            
            console.log(`[${userId}] Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            
            delete activeSockets[userId];
            
            if (!shouldReconnect) {
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`[${userId}] Logged out. Deleting session.`);
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                    }
                    await adminDb.collection('users').doc(userId).update({ whatsappConnected: false });
                    io.to(`user_${userId}`).emit('whatsapp_disconnected');
                } else {
                    console.log(`[${userId}] Session expired or timed out.`);
                    io.to(`user_${userId}`).emit('whatsapp_qr_expired');
                }
            } else {
                // If it's a normal network drop, try to reconnect
                setTimeout(() => initializeWhatsApp(userId, io), 3000);
            }
        } else if (connection === 'open') {
            console.log(`[${userId}] Connected! Session established.`);
            qrCount = 0; // Reset count on success
            await adminDb.collection('users').doc(userId).update({ whatsappConnected: true });
            io.to(`user_${userId}`).emit('whatsapp_ready', { userId });
        }
    });
};

