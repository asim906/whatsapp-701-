import { proto, WASocket, downloadMediaMessage } from '@whiskeysockets/baileys';
import { adminDb } from '../config/firebase-admin.js';
import { generateAIResponse } from '../ai/aiService.js';
import { messageStores } from './connection.js';
import { Server } from 'socket.io';
import { SyncService } from '../services/syncService.js';
import { CallController } from './callController.js';
import { VoiceService } from '../services/voiceService.js';
import { GroqService } from '../services/groqService.js';

// Simple deduplication cache to prevent double-replies to the same message ID
const processedMessages = new Set<string>();
const MAX_CACHE = 1000;

export const processIncomingMessage = async (
    userId: string,
    msg: proto.IWebMessageInfo,
    sock: WASocket,
    io: Server
) => {
    try {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) return;

        const messageId = msg.key.id || `msg_${Date.now()}`;
        
        // Deduplication: Skip if we already processed this exact message ID
        if (processedMessages.has(messageId)) {
            return;
        }

        // Add to cache & keep it under limit
        processedMessages.add(messageId);
        if (processedMessages.size > MAX_CACHE) {
            const firstEntry = processedMessages.values().next().value;
            if (firstEntry) processedMessages.delete(firstEntry);
        }

        // --- Subscription & Usage Guard ---
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const status = userData?.subscriptionStatus;
            const plan = userData?.plan;
            const usedMessages = userData?.stats?.messages || 0;
            
            if (status === 'inactive') {
                console.log(`[${userId}] ❌ System locked due to inactive subscription. Dropping message.`);
                return;
            }
            if (plan === 'startup' && usedMessages >= 100) {
                console.log(`[${userId}] ⚠️ Startup plan limit reached (100 msgs). Dropping message.`);
                return;
            }

            // Increment usage
            await userDoc.ref.update({
                'stats.messages': usedMessages + 1
            });
        }

        let messageType: 'text' | 'image' | 'audio' = 'text';
        let messageContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            "";
        
        let mediaData: string | undefined = undefined;

        // Handle Image Messages
        const imageMsg = msg.message?.imageMessage;
        if (imageMsg) {
            messageType = 'image';
            messageContent = imageMsg.caption || "";
            
            try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                mediaData = `data:${imageMsg.mimetype};base64,${buffer.toString('base64')}`;
            } catch (mediaErr) {
                console.warn(`[${userId}] Failed to download media:`, mediaErr);
            }
        }

        // Handle Audio Messages (For AI Calling & Voice Notes)
        const audioMsg = msg.message?.audioMessage;
        if (audioMsg) {
            console.log(`[${userId}] 🎤 Voice message received (${audioMsg.mimetype}).`);
            try {
                // 1. Fetch AI Settings for Language Hint
                let userLanguage = 'english';
                try {
                    const settingsDoc = await adminDb.collection('users').doc(userId).collection('settings').doc('ai').get();
                    if (settingsDoc.exists) {
                        userLanguage = settingsDoc.data()?.language || 'english';
                    }
                } catch (e) {} // Fail silently on settings fetch

                // 2. Retry Wrapper around downloadMediaMessage (handles EAI_AGAIN network drops)
                let buffer: Buffer | null = null;
                for (let dlAttempt = 1; dlAttempt <= 3; dlAttempt++) {
                    try {
                        buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer;
                        break;
                    } catch (dlErr: any) {
                        if (dlAttempt === 3) throw dlErr;
                        console.warn(`[${userId}] Media download attempt ${dlAttempt} failed, retrying...`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                if (!buffer) throw new Error("Failed to download audio buffer from WhatsApp Servers");

                // 3. Preprocess and Transcribe via Groq (with 10x faster auto-scaling)
                const transcription = await GroqService.transcribe(buffer, audioMsg.mimetype || 'audio/ogg', userLanguage);
                console.log(`[${userId}] ✅ Transcription completed: "${transcription}"`);
                
                messageType = 'audio'; 
                messageContent = transcription;
                // For audio messages, also pass the buffer as mediaData for the UI
                mediaData = `data:${audioMsg.mimetype || 'audio/ogg'};base64,${buffer.toString('base64')}`;

            } catch (err) {
                console.warn(`[${userId}] Failed to transcribe audio:`, err);
                messageType = 'text';
                messageContent = "🎙️ [VOICE MESSAGE RECEIVED] (Failed to transcribe)";
            }
        }

        if (!messageContent && !mediaData) return;

        const timestamp = new Date().toISOString();

        const payload = {
            id: messageId,
            type: messageType,
            text: messageContent,
            mediaData: mediaData || null,
            sender: remoteJid,
            timestamp,
            fromMe: false,
        };

        const isOnline = SyncService.isUserOnline(userId);

        if (isOnline) {
            // 1. IMMEDIATELY push to the frontend via Socket.IO
            io.to(`user_${userId}`).emit('new_message', payload);
            console.log(`[${userId}] 📨 ${messageType.toUpperCase()} pushed to UI (Online)`);
        } else {
            // 2. BUFFER for later sync
            await SyncService.addToBuffer(userId, 'message', payload);
            console.log(`[${userId}] 📥 ${messageType.toUpperCase()} buffered (Offline)`);
        }

        // 3. Always save to Firebase as backup
        try {
            await adminDb
                .collection('users')
                .doc(userId)
                .collection('inbox')
                .doc(messageId)
                .set({ ...payload, processed: false });
        } catch (fbErr) {
            console.warn(`[${userId}] Firebase write failed:`, fbErr);
        }

        // 4. Trigger AI reply (for text or audio context)
        if (messageType === 'text' || messageType === 'audio' || (messageType === 'image' && messageContent)) {
            const store = messageStores[userId];
            if (store) {
                const isVoiceNote = messageType === 'audio';
                await generateAIResponse(
                    userId, 
                    remoteJid, 
                    messageContent, 
                    sock, 
                    store, 
                    io, 
                    CallController.isCallActive(userId, remoteJid) || isVoiceNote
                );
            }
        }

    } catch (error) {
        console.error(`[${userId}] Error processing message:`, error);
    }
};
