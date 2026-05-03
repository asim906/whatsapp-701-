"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Loader2, Sparkles } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  contactJid: string;
  userId: string;
}

export default function CallModal({ isOpen, onClose, contactName, contactJid, userId }: CallModalProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState("Connecting...");
  const [transcript, setTranscript] = useState<{ user: string; ai: string }[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      startCall();
    } else {
      endCall();
    }
    return () => endCall();
  }, [isOpen]);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!socketRef.current) {
        const backendUrl = "https://whatsapp-701-production.up.railway.app";
        socketRef.current = io(backendUrl);
      
        socketRef.current.on("connect", () => {
          setStatus("Live");
          setIsCalling(true);
          socketRef.current?.emit("call_start", { userId, targetJid: contactJid });
        });
      }

      socketRef.current.on("ai_thinking", () => setIsThinking(true));
      
      socketRef.current.on("transcript_final", (data) => {
        setTranscript(prev => [...prev, data]);
        setIsThinking(false);
      });

      socketRef.current.on("audio_response", (audioBuffer: ArrayBuffer) => {
        const blob = new Blob([audioBuffer], { type: 'audio/ogg; codecs=opus' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      });

      // Microphone Recording Logic
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          socketRef.current.emit("audio_chunk", event.data);
        }
      };

      mediaRecorder.onstop = () => {
        socketRef.current?.emit("audio_end");
      };

      // Interval based chunking (send every 3 seconds of silence or fixed interval)
      // For simplicity, let's start/stop manually or use a Voice Activity Detection (VAD) later.
      // For now, let's just record in 3s slices.
      mediaRecorder.start(1000); // Send chunks every 1 second

    } catch (err) {
      console.error("Mic access denied:", err);
      setStatus("Microphone Error");
    }
  };

  const endCall = () => {
    mediaRecorderRef.current?.stop();
    socketRef.current?.emit("call_disconnect");
    socketRef.current?.disconnect();
    setIsCalling(false);
    setStatus("Disconnected");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-zinc-900/50 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          {/* Background Ambient Glow */}
          <div className="absolute inset-0 overflow-hidden -z-10">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] transition-colors duration-1000 ${isThinking ? 'bg-primary/30' : 'bg-blue-500/10'}`} />
          </div>

          <div className="p-8 flex flex-col items-center">
            {/* Header */}
            <div className="w-full flex justify-between items-center mb-10">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <div className={`w-2 h-2 rounded-full ${isCalling ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">{status}</span>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/30 hover:text-white"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar & Calling Animation */}
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-20" />
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-blue-600 p-1">
                <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                   <Phone className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">{contactName}</h2>
            <p className="text-white/40 mb-8 font-medium">AI Agent Calling...</p>

            {/* Live Transcript Display */}
            <div className="w-full h-40 overflow-y-auto mb-8 px-4 custom-scrollbar flex flex-col gap-3">
              {transcript.map((t, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <p className="text-xs text-white/30 font-bold uppercase tracking-tighter">You</p>
                  <p className="text-sm text-white/80">{t.user}</p>
                  <p className="text-xs text-primary/50 font-bold uppercase tracking-tighter mt-1 text-right">AI Assistant</p>
                  <p className="text-sm text-primary/90 text-right">{t.ai}</p>
                </div>
              ))}
              {isThinking && (
                <div className="flex items-center gap-2 text-primary/50 italic text-sm py-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  AI is thinking...
                </div>
              )}
              {transcript.length === 0 && !isThinking && (
                <p className="text-center text-white/20 text-sm mt-10 italic">Speak now, the AI is listening...</p>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-5 rounded-full border transition-all ${isMuted ? 'bg-red-500/20 border-red-500/30 text-red-500' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button 
                onClick={onClose}
                className="p-8 rounded-full bg-red-500 text-white shadow-2xl shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
              >
                <PhoneOff className="w-8 h-8" />
              </button>

              <div className="p-5 rounded-full bg-white/5 border border-white/10 text-white/70">
                <Volume2 className="w-6 h-6 outline-none" />
              </div>
            </div>
          </div>

          {/* Bottom Bar Decorative */}
          <div className="h-2 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
