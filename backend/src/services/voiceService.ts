import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { UniversalEdgeTTS } from 'edge-tts-universal';
import OpenAI from 'openai';
import { adminDb } from '../config/firebase-admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '../../temp_audio');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class VoiceService {
  /**
   * Convert Text to Speech (Generates an Opus OGG file buffer for WhatsApp PTT)
   * Using Microsoft Edge TTS (Free, high-quality neural voices)
   */
  static async textToSpeech(text: string, language: string = 'en-US'): Promise<Buffer> {
    const tempId = `tts_${Date.now()}`;
    const mp3Path = path.join(TEMP_DIR, `${tempId}.mp3`);
    const oggPath = path.join(TEMP_DIR, `${tempId}.ogg`);

    try {
      // 1. Sanitize text: Remove markdown and emojis
      const cleanText = text
        .replace(/[*_#~`]/g, '')
        .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
        .trim() || "Empty message";

      // 2. Select Voice - Auto Language Detection
      let voice = 'en-US-AriaNeural'; 
      // Regex to detect Arabic/Urdu script characters
      const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
      
      const isUrdu = urduRegex.test(cleanText) || language === 'ur' || language === 'ur-PK' || language.toLowerCase().includes('urdu');
      
      if (isUrdu) {
        voice = 'ur-PK-UzmaNeural'; // Supports both Urdu and mixed English nicely
      }

      console.log(`[Voice] Starting TTS | Voice: ${voice} | Text length: ${cleanText.length} | Preview: "${cleanText.substring(0, 30)}..."`);

      // 3. Split text into chunks to prevent TTS cutoff for long messages
      const MAX_CHUNK_LENGTH = 800; // Safe limit per TTS request
      const textChunks: string[] = [];
      let currentChunk = '';
      
      // Split by common sentence enders including Urdu full stop (۔) and newlines
      const parts = cleanText.split(/([.!?۔\n]+)/); 
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        
        if ((currentChunk.length + part.length) > MAX_CHUNK_LENGTH) {
          // If a single word is huge, force split
          if (currentChunk.trim()) {
            textChunks.push(currentChunk.trim());
          }
          currentChunk = part;
        } else {
          currentChunk += part;
        }
      }
      if (currentChunk.trim()) {
        textChunks.push(currentChunk.trim());
      }
      
      if (textChunks.length === 0) textChunks.push("Empty message");

      // 4. Synthesize chunks and concatenate MP3 buffers
      let finalAudioBuffer: Buffer = Buffer.alloc(0);

      for (const chunk of textChunks) {
        if (!chunk.trim()) continue;
        
        const tts = new UniversalEdgeTTS(chunk, voice);
        const audioData: any = await tts.synthesize();
        
        if (!audioData) {
          throw new Error("Edge TTS returned no audio data for chunk.");
        }

        let buffer: Buffer;
        if (audioData.audio && typeof audioData.audio.arrayBuffer === 'function') {
          const arrayBuffer = await audioData.audio.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else if (Buffer.isBuffer(audioData)) {
          buffer = audioData;
        } else if (audioData instanceof Uint8Array) {
          buffer = Buffer.from(audioData);
        } else if (audioData.data && (audioData.data instanceof Uint8Array || Array.isArray(audioData.data))) {
          buffer = Buffer.from(audioData.data);
        } else {
          throw new Error("Unsupported audio data format from Edge TTS");
        }
        
        // MP3 frames can be safely concatenated by joining buffers
        finalAudioBuffer = Buffer.concat([finalAudioBuffer, buffer]);
      }

      fs.writeFileSync(mp3Path, finalAudioBuffer);
      console.log(`[Voice] MP3 generated from ${textChunks.length} chunks: ${finalAudioBuffer.byteLength} bytes`);

      // 5. Convert concatenated MP3 to Opus OGG (WhatsApp Requirement)
      return new Promise((resolve, reject) => {
        ffmpeg(mp3Path)
          .toFormat('opus')
          .on('end', () => {
             console.log(`[Voice] OGG conversion complete.`);
             const oggBuffer = fs.readFileSync(oggPath);
             // Cleanup
             try {
               if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
               if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
             } catch (e) {}
             resolve(oggBuffer);
          })
          .on('error', (err) => {
            console.error('[Voice] FFmpeg Conversion Error:', err);
            reject(err);
          })
          .save(oggPath);
      });
    } catch (error) {
      console.error('[Voice] TTS Error:', error);
      // Ensure cleanup if error happens
      try {
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
      } catch (e) {}
      throw error;
    }
  }

  /**
   * Convert Speech to Text (Transcribes via OpenAI Whisper)
   */
  static async speechToText(userId: string, audioBuffer: Buffer): Promise<string> {
    const tempId = `stt_${Date.now()}`;
    const oggPath = path.join(TEMP_DIR, `${tempId}.ogg`);
    const wavPath = path.join(TEMP_DIR, `${tempId}.wav`);

    try {
      const settingsDoc = await adminDb.collection('users').doc(userId).collection('settings').doc('ai').get();
      const settings = settingsDoc.data();
      const apiKey = settings?.openAiKey || settings?.openRouterKey || process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error('AI API Key not found for transcription.');
      }

      const openai = new OpenAI({ apiKey });
      fs.writeFileSync(oggPath, audioBuffer);

      await new Promise((resolve, reject) => {
        ffmpeg(oggPath)
          .toFormat('wav')
          .on('end', resolve)
          .on('error', reject)
          .save(wavPath);
      });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(wavPath),
        model: 'whisper-1',
      });

      return transcription.text;
    } catch (error) {
      console.error('[Voice] STT Error:', error);
      throw error;
    } finally {
      try {
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
      } catch (e) {}
    }
  }
}
