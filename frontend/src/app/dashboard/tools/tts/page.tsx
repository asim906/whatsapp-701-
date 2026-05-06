'use client';
import React, { useState } from 'react';
import { Mic, Play, Download, Languages, Loader2 } from 'lucide-react';

export default function TTSPage() {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [detectedLang, setDetectedLang] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!text) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/tools/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            if (data.audioData) {
                setAudioUrl(data.audioData);
                setDetectedLang(data.language);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                    <Mic className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Antigravity Neural TTS</h1>
                    <p className="text-gray-400">Self-Hosted Multilingual Speech Engine</p>
                </div>
            </div>

            {/* Main Synthesis Card */}
            <div className="bg-gray-900/50 border border-gray-800 backdrop-blur-xl rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Languages className="w-5 h-5 text-purple-400" />
                        Speech Synthesis
                    </h2>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Input Text (Urdu, Hindi, or English)</label>
                        <input 
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Type something in Urdu or English..."
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all h-12"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        {detectedLang && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                                    Detected: {detectedLang}
                                </span>
                            </div>
                        )}
                        <button 
                            onClick={handleGenerate} 
                            disabled={isLoading || !text}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all ml-auto"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Generate Speech
                        </button>
                    </div>

                    {audioUrl && (
                        <div className="mt-6 p-4 bg-black/40 rounded-xl border border-gray-800 space-y-4">
                            <audio src={audioUrl} controls className="w-full h-10 filter invert opacity-80" />
                            <div className="flex gap-2">
                                <a 
                                    href={audioUrl} 
                                    download="speech.ogg"
                                    className="flex-1 bg-white/5 hover:bg-white/10 border border-gray-700 rounded-xl py-3 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    Download WhatsApp Format
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/30 border border-gray-800 p-5 rounded-2xl text-center space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Status</p>
                    <p className="text-green-400 font-bold">Self-Hosted (Local)</p>
                </div>
                <div className="bg-gray-900/30 border border-gray-800 p-5 rounded-2xl text-center space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Engine</p>
                    <p className="text-white font-bold">Neural MMS/Piper</p>
                </div>
                <div className="bg-gray-900/30 border border-gray-800 p-5 rounded-2xl text-center space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Cache</p>
                    <p className="text-white font-bold">Enabled</p>
                </div>
            </div>
        </div>
    );
}
