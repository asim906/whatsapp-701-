import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '../../temp_audio');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class GroqService {
    private static groq: Groq | null = null;

    private static init() {
        if (!this.groq) {
            this.groq = new Groq({
                apiKey: process.env.GROQ_API_KEY
            });
        }
    }

    /**
     * Transcribe speech using Groq's Whisper-large-v3 model with FFmpeg normalization
     */
    static async transcribe(audioBuffer: Buffer, mimetype: string = 'audio/webm', languageContext: string = ''): Promise<string> {
        this.init();
        if (!this.groq) throw new Error("Groq client failed to initialize");

        const extension = mimetype.includes('ogg') ? 'ogg' : (mimetype.split('/')[1] || 'webm');
        const tempId = `groq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const inputFilePath = path.join(TEMP_DIR, `${tempId}.${extension}`);
        const wavFilePath = path.join(TEMP_DIR, `${tempId}.wav`);
        
        fs.writeFileSync(inputFilePath, audioBuffer);
        
        try {
            // 1. Pre-process and normalize audio via FFmpeg to 16kHz WAV (Whisper standard)
            await new Promise((resolve, reject) => {
                ffmpeg(inputFilePath)
                  .toFormat('wav')
                  .audioChannels(1)
                  .audioFrequency(16000)
                  .on('end', resolve)
                  .on('error', reject)
                  .save(wavFilePath);
            });

            // 2. Retry loop for API stability
            const maxRetries = 2;
            let lastError: any;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`[Groq] Transcribing ${tempId}.wav (Attempt ${attempt})...`);
                    
                    const transcriptionParams: any = {
                        file: fs.createReadStream(wavFilePath),
                        model: "whisper-large-v3",
                        response_format: "text",
                    };

                    // Apply context hint if a specific language is being used
                    if (languageContext && languageContext.toLowerCase().includes('urdu')) {
                        // Pass a robust prompt to stabilize Roman Urdu recognition internally
                        transcriptionParams.prompt = "The user is speaking Urdu or native Hindi, please carefully transcribe accurately if it is Roman English layout or original language.";
                    }

                    const translation = await this.groq.audio.transcriptions.create(transcriptionParams);
                    
                    return translation as unknown as string;

                } catch (apiError: any) {
                    lastError = apiError;
                    console.warn(`[Groq] Transcription attempt ${attempt} failed:`, apiError?.message || apiError);
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                    }
                }
            }
            throw lastError;

        } catch (error) {
            console.error("[Groq] Final Transcription Error:", error);
            throw error;
        } finally {
            // Cleanup Temp files safely
            if (fs.existsSync(inputFilePath)) fs.unlinkSync(inputFilePath);
            if (fs.existsSync(wavFilePath)) fs.unlinkSync(wavFilePath);
        }
    }
}
