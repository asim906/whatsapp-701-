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
  static async textToSpeech(text: string, language: string = 'en'): Promise<Buffer> {
    const TEMP_DIR = path.join(process.cwd(), 'temp_audio');
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    try {
      const cleanText = text
        .replace(/[*_#~`]/g, '')
        .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
        .trim() || "Empty message";

      let ttsLang = 'en'; 
      // Regex to detect Arabic/Urdu script characters
      const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
      
      if (urduRegex.test(cleanText) || language === 'ur' || language === 'ur-PK' || language.toLowerCase().includes('urdu')) {
        ttsLang = 'ur';
      }

      console.log(`[Voice] Unified Google TTS generating audio for lang: ${ttsLang}...`);
      
      const tempId = Date.now();
      const oggPath = path.join(TEMP_DIR, `tts_${tempId}.ogg`);

      const { getAllAudioBase64 } = await import('google-tts-api');
      const results = await getAllAudioBase64(cleanText, {
          lang: ttsLang,
          slow: false,
          host: 'https://translate.google.com',
          splitPunct: '۔,.'
      });
      
      // We must use FFmpeg concat demuxer to safely merge MP3s without breaking ID3 tags
      const listPath = path.join(TEMP_DIR, `list_${tempId}.txt`);
      let listContent = '';
      const tempFiles = [];

      for (let i = 0; i < results.length; i++) {
          const chunkPath = path.join(TEMP_DIR, `chunk_${tempId}_${i}.mp3`);
          fs.writeFileSync(chunkPath, Buffer.from(results[i].base64, 'base64'));
          // Use forward slashes for FFmpeg compatibility on all OS
          listContent += `file '${chunkPath.replace(/\\/g, '/')}'\n`;
          tempFiles.push(chunkPath);
      }
      
      fs.writeFileSync(listPath, listContent);
      
      return new Promise((resolve, reject) => {
          ffmpeg()
            .input(listPath)
            .inputOptions(['-f concat', '-safe 0'])
            .audioCodec('libopus')
            .audioBitrate('32k')
            .audioChannels(1)
            .audioFrequency(48000)
            .outputOptions(['-avoid_negative_ts make_zero'])
            .toFormat('ogg')
            .on('end', () => {
               console.log(`[Voice] Google TTS Concatenation & Conversion complete.`);
               const oggBuffer = fs.readFileSync(oggPath);
               // Cleanup
               try {
                 if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
                 if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
                 for (const file of tempFiles) {
                     if (fs.existsSync(file)) fs.unlinkSync(file);
                 }
               } catch (e) {}
               resolve(oggBuffer);
            })
            .on('error', (err) => {
              console.error('[Voice] FFmpeg Concat Error:', err.message);
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
