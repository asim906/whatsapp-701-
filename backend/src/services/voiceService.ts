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
      console.log(`[Voice] Starting Edge TTS for: "${text.substring(0, 30)}..." (Lang: ${language})`);
      
      // 1. Sanitize text: Remove markdown and emojis
      const cleanText = text
        .replace(/[*_#~`]/g, '')
        .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
        .trim() || "Empty message";

      // 2. Select Voice
      let voice = 'en-US-AriaNeural'; 
      if (language === 'ur' || language === 'ur-PK' || language.toLowerCase().includes('urdu')) {
        voice = 'ur-PK-UzmaNeural';
      }

      console.log(`[Voice] Selected Voice: ${voice}`);

      // 3. Synthesize
      const tts = new UniversalEdgeTTS(cleanText, voice);
      const audioData: any = await tts.synthesize();
      
      if (!audioData) {
        throw new Error("Edge TTS returned no audio data.");
      }

      console.log(`[Voice] Audio data received. Type: ${typeof audioData}, IsBuffer: ${Buffer.isBuffer(audioData)}`);

      // 4. Robust Buffer Conversion
      let buffer: Buffer;
      
      // Handle the object format: { audio: Blob, subtitle: [...] }
      if (audioData.audio && typeof audioData.audio.arrayBuffer === 'function') {
        console.log(`[Voice] Detected Blob in audio property. Converting...`);
        const arrayBuffer = await audioData.audio.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
      } else if (audioData instanceof Uint8Array) {
        buffer = Buffer.from(audioData);
      } else if (audioData.data && (audioData.data instanceof Uint8Array || Array.isArray(audioData.data))) {
        buffer = Buffer.from(audioData.data);
      } else {
        console.error("[Voice] Unsupported audio data format:", JSON.stringify(audioData, null, 2).substring(0, 500));
        throw new Error("Unsupported audio data format from Edge TTS");
      }

      fs.writeFileSync(mp3Path, buffer);
      console.log(`[Voice] MP3 generated: ${buffer.byteLength} bytes`);

      // 4. Convert MP3 to Opus OGG (WhatsApp Requirement)
      return new Promise((resolve, reject) => {
        ffmpeg(mp3Path)
          .toFormat('opus')
          .on('start', (cmd) => console.log(`[Voice] FFmpeg Command: ${cmd}`))
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
