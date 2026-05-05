'use client';
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Languages className="w-5 h-5 text-purple-400" />
                        Speech Synthesis
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Input Text (Urdu, Hindi, or English)</Label>
                        <Input 
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Type something in Urdu or English..."
                            className="bg-gray-800/50 border-gray-700 text-white h-12"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        {detectedLang && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
                                <span className="text-xs font-medium text-purple-400 uppercase">
                                    Detected: {detectedLang}
                                </span>
                            </div>
                        )}
                        <Button 
                            onClick={handleGenerate} 
                            disabled={isLoading || !text}
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 ml-auto"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Generate Speech
                        </Button>
                    </div>

                    {audioUrl && (
                        <div className="mt-6 p-4 bg-black/40 rounded-xl border border-gray-800 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <audio src={audioUrl} controls className="w-full h-10 filter invert" />
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 gap-2 border-gray-700 hover:bg-gray-800" asChild>
                                    <a href={audioUrl} download="speech.ogg">
                                        <Download className="w-4 h-4" />
                                        Download WhatsApp Format
                                    </a>
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gray-900/30 border-gray-800 p-4 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-green-400 font-bold">Self-Hosted (Local)</p>
                </Card>
                <Card className="bg-gray-900/30 border-gray-800 p-4 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Engine</p>
                    <p className="text-white font-bold">Neural MMS/Piper</p>
                </Card>
                <Card className="bg-gray-900/30 border-gray-800 p-4 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Cache</p>
                    <p className="text-white font-bold">Enabled</p>
                </Card>
            </div>
        </div>
    );
}
