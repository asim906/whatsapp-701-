import { Server, Socket } from 'socket.io';
import { GroqService } from './groqService.js';
import { processAIEngine } from '../ai/aiService.js';
import { VoiceService } from './voiceService.js';
import { adminDb } from '../config/firebase-admin.js';

interface VoiceSession {
    userId: string;
    targetJid: string;
    audioChunks: Buffer[];
    isProcessing: boolean;
}

const activeSessions: Map<string, VoiceSession> = new Map();

export class VoiceSessionManager {
    static init(io: Server) {
        io.on('connection', (socket: Socket) => {
            console.log(`[Voice] Socket connected for signaling: ${socket.id}`);

            socket.on('call_start', async ({ userId, targetJid }) => {
                console.log(`[Voice] Call started for user ${userId} to ${targetJid}`);
                activeSessions.set(socket.id, {
                    userId,
                    targetJid,
                    audioChunks: [],
                    isProcessing: false
                });

                // Optional: Save "Call Started" message to UI
                const startMsg = {
                    id: `call_${Date.now()}`,
                    type: 'text',
                    text: `📞 [AI CALL STARTED]: Voice session with ${targetJid}`,
                    sender: targetJid,
                    timestamp: new Date().toISOString(),
                    fromMe: true
                };
                io.to(`user_${userId}`).emit('new_message', startMsg);
            });

            socket.on('audio_chunk', async (chunk: Buffer) => {
                const session = activeSessions.get(socket.id);
                if (session) {
                    session.audioChunks.push(Buffer.from(chunk));
                }
            });

            socket.on('audio_end', async () => {
                const session = activeSessions.get(socket.id);
                if (!session || session.isProcessing) return;

                session.isProcessing = true;
                try {
                    const fullBuffer = Buffer.concat(session.audioChunks);
                    session.audioChunks = []; // Clear for next turn

                    // 1. STT via Groq
                    console.log(`[Voice] Processing ${fullBuffer.length} bytes of audio...`);
                    const transcript = await GroqService.transcribe(fullBuffer);
                    console.log(`[Voice] User said: "${transcript}"`);

                    if (!transcript.trim() || transcript.length < 2) {
                        session.isProcessing = false;
                        return;
                    }

                    // Save User Transcript to Dashboard
                    const userMsg = {
                        id: `voice_u_${Date.now()}`,
                        type: 'text',
                        text: `[VOICE TRANSCRIPT]: ${transcript}`,
                        sender: session.targetJid,
                        timestamp: new Date().toISOString(),
                        fromMe: false
                    };
                    io.to(`user_${session.userId}`).emit('new_message', userMsg);

                    // 2. Get AI Response (Real AI engine)
                    socket.emit('ai_thinking');
                    
                    const aiResult = await processAIEngine(session.userId, session.targetJid, transcript, true);
                    const replyText = aiResult?.finalText || "I'm sorry, I couldn't process that.";
                    
                    console.log(`[Voice] AI replied: "${replyText}"`);

                    // 3. Save AI Response to Dashboard
                    const aiMsg = {
                        id: `voice_ai_${Date.now()}`,
                        type: 'text',
                        text: replyText,
                        sender: session.targetJid,
                        timestamp: new Date().toISOString(),
                        fromMe: true
                    };
                    io.to(`user_${session.userId}`).emit('new_message', aiMsg);

                    // Persistence: Save to Firebase
                    await adminDb.collection('users').doc(session.userId).collection('inbox').doc(aiMsg.id).set(aiMsg);

                    // 4. TTS via Google
                    const settingsDoc = await adminDb.collection('users').doc(session.userId).collection('settings').doc('ai').get();
                    const settings = settingsDoc.data();
                    const audioResponse = await VoiceService.textToSpeech(replyText, settings?.language === 'urdu' ? 'ur' : 'en');
                    
                    // 5. Stream back to client
                    socket.emit('audio_response', audioResponse);
                    socket.emit('transcript_final', { user: transcript, ai: replyText });

                } catch (error) {
                    console.error("[Voice] Session processing error:", error);
                    socket.emit('call_error', 'Failed to process voice');
                } finally {
                    session.isProcessing = false;
                }
            });

            socket.on('call_disconnect', () => {
                activeSessions.delete(socket.id);
                console.log(`[Voice] Session cleared for ${socket.id}`);
            });
        });
    }
}
