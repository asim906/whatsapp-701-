import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class TTSService {
    private static MODEL_DIR = path.join(process.cwd(), 'models', 'tts');
    private static CACHE_DIR = path.join(process.cwd(), 'temp_audio', 'tts_cache');

    static init() {
        if (!fs.existsSync(this.MODEL_DIR)) fs.mkdirSync(this.MODEL_DIR, { recursive: true });
        if (!fs.existsSync(this.CACHE_DIR)) fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }

    /**
     * Detects the language based on script ranges
     */
    static detectLanguage(text: string): 'ur' | 'hi' | 'en' {
        const urduRegex = /[\u0600-\u06FF]/;
        const hindiRegex = /[\u0900-\u097F]/;

        if (urduRegex.test(text)) return 'ur';
        if (hindiRegex.test(text)) return 'hi';
        return 'en';
    }

    /**
     * Generates a unique hash for the text to use as a cache key
     */
    private static getCacheKey(text: string, voice: string): string {
        return crypto.createHash('md5').update(`${text}_${voice}`).digest('hex');
    }

    /**
     * Core Speech Generation (Self-Hosted)
     */
    static async generateSpeech(text: string, overrideLang?: string): Promise<Buffer> {
        this.init();
        const lang = overrideLang || this.detectLanguage(text);
        const cacheKey = this.getCacheKey(text, lang);
        const cachePath = path.join(this.CACHE_DIR, `${cacheKey}.ogg`);

        // 1. Check Cache
        if (fs.existsSync(cachePath)) {
            console.log(`[TTS] Cache Hit: ${cacheKey}`);
            return fs.readFileSync(cachePath);
        }

        console.log(`[TTS] Generating Local Speech (${lang.toUpperCase()}): "${text.substring(0, 30)}..."`);

        let audioBuffer: Buffer;
        try {
            // Note: For actual binary execution, we would call Piper or Sherpa binaries here.
            // For now, we integrate with a robust local synthesis strategy.
            // Placeholder for the local binary execution logic:
            audioBuffer = await this.synthesizeLocal(text, lang);
            
            // 2. Normalize and Convert to WhatsApp OGG
            const processedBuffer = await this.normalizeAudio(audioBuffer);
            
            // 3. Save to Cache
            fs.writeFileSync(cachePath, processedBuffer);
            return processedBuffer;
        } catch (err: any) {
            console.error(`[TTS] Local Synthesis Failed:`, err.message);
            throw err;
        }
    }

    private static async synthesizeLocal(text: string, lang: string): Promise<Buffer> {
        // --- MULTILINGUAL MODEL ROUTING ---
        // English -> Piper (Optimized)
        // Urdu/Hindi -> Meta MMS (High Fidelity)
        
        return new Promise(async (resolve, reject) => {
            const tempFile = path.join(this.CACHE_DIR, `inference_${Date.now()}.wav`);
            
            // Note: In a production self-hosted environment, we would execute the pre-downloaded 
            // Piper/MMS binary here. For this implementation, I am setting up the bridge 
            // that handles the local filesystem execution.
            
            // Example Command:
            // piper.exe --model models/tts/en_US-aria-medium.onnx --output_file ...
            
            console.log(`[TTS] Executing local inference for ${lang}...`);
            
            // Placeholder: For first run, we use a robust system-wide local synthesis
            // or a pre-configured local binary. 
            // To ensure 100% "No-API" status, we route to the local executable.
            
            try {
                // If local binary exists, use it. Otherwise, we provide a 
                // "Model Not Found" clear error to prompt the user to download.
                const modelPath = path.join(this.MODEL_DIR, `${lang}_model.onnx`);
                
                if (!fs.existsSync(modelPath)) {
                    return reject(new Error(`Model for ${lang} not found at ${modelPath}. Please download models to 'backend/models/tts/'.`));
                }

                // Execute local inference binary
                // exec(`piper --model ${modelPath} ...`, (err, stdout, stderr) => { ... });
                
                reject(new Error("Local model execution requires binary setup. Please ensure 'piper' or 'sherpa-onnx' is in your system path."));
            } catch (e: any) {
                reject(e);
            }
        });
    }

    private static async normalizeAudio(input: Buffer): Promise<Buffer> {
        const tempInput = path.join(this.CACHE_DIR, `temp_${Date.now()}.wav`);
        const tempOutput = path.join(this.CACHE_DIR, `temp_${Date.now()}.ogg`);
        fs.writeFileSync(tempInput, input);

        return new Promise((resolve, reject) => {
            ffmpeg(tempInput)
                .audioCodec('libopus')
                .audioBitrate('32k')
                .audioChannels(1)
                .audioFrequency(48000)
                .outputOptions(['-avoid_negative_ts make_zero'])
                .toFormat('ogg')
                .on('end', () => {
                    const result = fs.readFileSync(tempOutput);
                    fs.unlinkSync(tempInput);
                    fs.unlinkSync(tempOutput);
                    resolve(result);
                })
                .on('error', (err) => {
                    reject(err);
                })
                .save(tempOutput);
        });
    }
}
