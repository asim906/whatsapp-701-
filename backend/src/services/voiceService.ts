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
  static async textToSpeech(text: string, language: string = 'en', settings: any = null): Promise<Buffer> {
    const TEMP_DIR = path.join(process.cwd(), 'temp_audio');
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    try {
      // 1. Sanitize text
      const cleanText = text
        .replace(/[*_#~`]/g, '')
        .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
        .trim() || "Empty message";

      // 2. Determine voice
      let voice = 'en-US-AriaNeural'; 
      const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
      
      const isUrdu = urduRegex.test(cleanText) || language === 'ur' || language === 'ur-PK' || language.toLowerCase().includes('urdu');
      if (isUrdu) voice = 'ur-PK-UzmaNeural';

      console.log(`[Voice] Starting TTS | Text preview: "${cleanText.substring(0, 30)}..."`);

      // ==========================================
      // PREMIUM PIPELINE: OpenAI Native TTS
      // ==========================================
      const openAiKey = settings?.openAiKey || process.env.OPENAI_API_KEY;
      if (openAiKey) {
          try {
              console.log(`[Voice] Using Premium OpenAI TTS for flawless output...`);
              const openai = new OpenAI({ apiKey: openAiKey });
              const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "nova", // Nova sounds fantastic for both English and Urdu
                input: cleanText,
                response_format: "opus" // Native WhatsApp compatible!
              });
              
              const buffer = Buffer.from(await mp3.arrayBuffer());
              console.log(`[Voice] OpenAI TTS generated ${buffer.byteLength} bytes natively.`);
              return buffer; // Bypass FFmpeg completely! Perfect duration!
          } catch (openaiErr: any) {
              console.warn(`[Voice] OpenAI TTS Failed, falling back to Edge TTS: ${openaiErr.message}`);
          }
      }

      // ==========================================
      // FALLBACK PIPELINE: Microsoft Edge TTS
      // ==========================================
      const tempId = Date.now();
      const mp3Path = path.join(TEMP_DIR, `tts_${tempId}.mp3`);
      const wavPath = path.join(TEMP_DIR, `tts_${tempId}.wav`);
      const oggPath = path.join(TEMP_DIR, `tts_${tempId}.ogg`);

      // 3. Chunk text intelligently to prevent UniversalEdgeTTS truncation
      const MAX_CHUNK_LENGTH = 800;
      const parts = cleanText.split(/([.!?۔\n]+)/); 
      const textChunks: string[] = [];
      let currentChunk = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        if ((currentChunk.length + part.length) > MAX_CHUNK_LENGTH) {
          if (currentChunk.trim()) textChunks.push(currentChunk.trim());
          currentChunk = part;
        } else {
          currentChunk += part;
        }
      }
      if (currentChunk.trim()) textChunks.push(currentChunk.trim());
      if (textChunks.length === 0) textChunks.push("Empty message");

      // 4. Synthesize Edge TTS
      let finalAudioBuffer: Buffer = Buffer.alloc(0);
      for (let index = 0; index < textChunks.length; index++) {
        const chunk = textChunks[index];
        if (!chunk.trim()) continue;
        
        const tts = new UniversalEdgeTTS(chunk, voice);
        const audioData: any = await tts.synthesize();
        
        let buffer: Buffer;
        if (audioData.audio && typeof audioData.audio.arrayBuffer === 'function') {
          buffer = Buffer.from(await audioData.audio.arrayBuffer());
        } else if (Buffer.isBuffer(audioData)) {
          buffer = audioData;
        } else {
          buffer = Buffer.from(audioData.data || audioData);
        }
        
        finalAudioBuffer = Buffer.concat([finalAudioBuffer, buffer]);
      }
      
      console.log(`[Voice] Edge TTS Generated MP3 size: ${finalAudioBuffer.byteLength} bytes`);
      
      // CRITICAL: Prevent 0:00 silent voice notes when Microsoft blocks Railway IPs
      if (finalAudioBuffer.byteLength < 2000) {
          throw new Error(`Edge TTS returned empty or invalid data (IP likely blocked). Buffer size: ${finalAudioBuffer.byteLength}`);
      }

      fs.writeFileSync(mp3Path, finalAudioBuffer);
      
      // 5. Convert MP3 to WAV (CRITICAL: This strips all corrupt MP3 headers and encoder delays)
      await new Promise((resolve, reject) => {
          ffmpeg(mp3Path)
            .toFormat('wav')
            .audioChannels(1)
            .audioFrequency(48000)
            .on('end', resolve)
            .on('error', reject)
            .save(wavPath);
      });

      // 6. Convert pure PCM WAV to Opus OGG (Guarantees perfect duration headers)
      return new Promise((resolve, reject) => {
          ffmpeg(wavPath)
            .inputFormat('wav')
            .audioCodec('libopus')
            .audioBitrate('32k')
            .audioChannels(1)
            .audioFrequency(48000)
            .outputOptions(['-avoid_negative_ts make_zero'])
            .toFormat('ogg')
            .on('end', () => {
               console.log(`[Voice] FFmpeg OGG conversion complete.`);
               let oggBuffer: Buffer;
               try {
                   oggBuffer = fs.readFileSync(oggPath);
               } catch (e) {
                   return reject(new Error("Failed to read generated OGG file"));
               }
               
               // Cleanup
               try {
                 if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                 if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
                 if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
               } catch (e) {}
               
               // CRITICAL: Detect 0:00 duration bugs and trigger Roman Urdu Fallback
               if (oggBuffer.byteLength < 1500) {
                   console.error(`[Voice] 🚨 CRITICAL: Generated OGG file is empty or silent (${oggBuffer.byteLength} bytes). Triggering fallback...`);
                   return reject(new Error("TTS_SILENCE_DETECTED"));
               }

               resolve(oggBuffer);
            })
            .on('error', (err) => {
              console.error('[Voice] FFmpeg Conversion Error:', err.message);
              reject(err);
            })
            .save(oggPath);
      });
    } catch (error) {
      console.error('[Voice] TTS Pipeline Fatal Error:', error);
      // Ensure cleanup if error happens
      try {
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
