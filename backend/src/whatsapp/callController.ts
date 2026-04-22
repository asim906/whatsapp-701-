import { WASocket } from '@whiskeysockets/baileys';
import { Server } from 'socket.io';
import { VoiceService } from '../services/voiceService.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { SyncService } from '../services/syncService.js';
import { adminDb } from '../config/firebase-admin.js';

// In-memory track of who is in an "AI Call" state
// Key: userId:remoteJid
const activeCallSessions = new Set<string>();

export class CallController {
  
  static isCallActive(userId: string, remoteJid: string): boolean {
    return activeCallSessions.has(`${userId}:${remoteJid}`);
  }

  static endCall(userId: string, remoteJid: string) {
    activeCallSessions.delete(`${userId}:${remoteJid}`);
  }

  /**
   * Start an AI Voice Call (Intercom Mode)
   */
  static async startCall(userId: string, remoteJid: string, sock: WASocket, io: Server) {
    try {
      console.log(`[Call] Initiating AI Call for ${userId} -> ${remoteJid}`);
      
      activeCallSessions.add(`${userId}:${remoteJid}`);

      // 1. Get AI Settings to know the language/personality
      const settingsDoc = await adminDb.collection('users').doc(userId).collection('settings').doc('ai').get();
      const settings = settingsDoc.data();
      const language = settings?.language === 'urdu' ? 'ur' : 'en';

      // 2. Initial Greeting
      const greetingText = settings?.language === 'urdu' 
        ? "Assalam o Alaikum! Mein AI Assistant hoon. Mein aapki kia madad kar sakti hoon?"
        : "Hello! I am your AI assistant. How can I help you today?";

      const audioBuffer = await VoiceService.textToSpeech(greetingText, language);

      // 3. Send PTT (Voice Note) to WhatsApp
      await sock.sendMessage(remoteJid, { 
        audio: audioBuffer, 
        ptt: true,
        mimetype: 'audio/ogg; codecs=opus' 
      });

      // 4. Update UI via Socket.io
      const payload = {
        id: `call_${Date.now()}`,
        type: 'audio',
        text: `[AI CALL STARTED]: ${greetingText}`,
        mediaData: `data:audio/ogg;base64,${audioBuffer.toString('base64')}`,
        sender: remoteJid,
        timestamp: new Date().toISOString(),
        fromMe: true,
      };

      io.to(`user_${userId}`).emit('new_message', payload);
      await AnalyticsService.trackEvent(userId, 'aiResponses');

      console.log(`[Call] Call session active and greeting sent.`);

    } catch (error) {
      console.error('[Call] Error starting call:', error);
      activeCallSessions.delete(`${userId}:${remoteJid}`);
      throw error;
    }
  }
}
