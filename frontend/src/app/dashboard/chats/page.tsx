"use client";

import { useEffect, useState, useRef } from "react";
import { User, Bot, CheckCheck, Send, Search, Image as ImageIcon, Phone, PhoneOff, Mic } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { useChatStore } from "@/store/chatStore";
import CallModal from "@/components/CallModal";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function ChatsPage() {
  const [user] = useAuthState(auth);
  
  // Zustand Global State
  const chats = useChatStore(state => state.chats);
  const messages = useChatStore(state => state.activeMessages);
  const selectedChatId = useChatStore(state => state.selectedChatId);
  const selectChat = useChatStore(state => state.selectChat);
  const addMessage = useChatStore(state => state.addMessage);

  const selectedChat = chats.find(c => c.id === selectedChatId) || null;
  
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [showLiveCall, setShowLiveCall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Check initial call status when chat is selected
  useEffect(() => {
    if (!selectedChatId || !user) return;
    fetch(`${BACKEND_URL}/api/whatsapp/call/status?userId=${user.uid}&jid=${selectedChatId}`)
      .then(r => r.json())
      .then(data => setIsCalling(data.active))
      .catch(e => console.warn("Failed to fetch call status", e));
  }, [selectedChatId, user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChat || !user || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    const msgId = `opt_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Optimistic UI update via Store
    const optimisticMsg: any = {
      id: msgId,
      chatId: selectedChat.id,
      type: 'text',
      text,
      fromMe: true,
      timestamp,
    };

    await addMessage(optimisticMsg);

    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, jid: selectedChat.id, text }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to send message. Backend responded with:", res.status, errorData);
        alert(`Failed to send message: ${errorData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error("Send error (network or crash):", err);
      alert("Network error: Could not reach backend.");
    } finally {
      setSending(false);
    }
  };

  const handleCall = async () => {
    if (!selectedChatId || !user || isCalling) return;
    
    setIsCalling(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, jid: selectedChatId }),
      });
      if (!res.ok) {
        setIsCalling(false);
        console.error("Failed to start AI Call");
      }
    } catch (err) {
      setIsCalling(false);
      console.error("Call error:", err);
    }
  };

  const endCall = async () => {
    if (!selectedChatId || !user) return;
    setIsCalling(false);
    await fetch(`${BACKEND_URL}/api/whatsapp/call/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, jid: selectedChatId }),
    });
  };

  const filteredChats = chats.filter(c => {
    const chatName = (c.name || c.id || "").toLowerCase();
    const searchStr = (search || "").toLowerCase();
    return chatName.includes(searchStr);
  });

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatJid = (jid: string) => jid?.split("@")[0] || jid;

  return (
    <div className="h-full flex flex-col pt-0 sm:pt-4">
      <div className="flex-1 flex overflow-hidden glass-panel rounded-2xl border border-white/5 shadow-2xl shadow-primary/5">

        {/* Sidebar */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col ${selectedChat ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Chats</h2>
              <button className="p-2 rounded-full hover:bg-white/5 text-foreground/40" title="Refresh local storage">
                <Bot className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search chats"
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-white/10 rounded-xl text-sm text-white placeholder-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-foreground/50 text-sm flex flex-col items-center gap-2">
                <Bot className="w-8 h-8 opacity-30" />
                No chats yet.<br />Connect WhatsApp to start.
              </div>
            ) : (
              filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={`p-4 flex gap-3 cursor-pointer select-none transition-colors border-b border-white/5 ${selectedChatId === chat.id ? "bg-primary/10" : "hover:bg-white/5"}`}
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center relative">
                    <User className="w-6 h-6 text-foreground/50" />
                    {chat.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-white truncate">{chat.name || formatJid(chat.id)}</span>
                      <span className="text-xs text-foreground/40 flex-shrink-0 ml-2">{formatTime(chat.lastMessageTime)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {chat.lastMessage === 'photo' && <ImageIcon className="w-3.5 h-3.5 text-foreground/40 shrink-0" />}
                      {chat.lastMessage === 'Voice message' && <Mic className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <p className="text-sm text-foreground/60 truncate">{chat.lastMessage}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-[#0b0c10] ${!selectedChat ? "hidden md:flex" : "flex"}`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4 md:px-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                  <button className="md:hidden p-2 -ml-2 text-foreground/60" onClick={() => selectChat(null)}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-foreground/50" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{selectedChat.name || formatJid(selectedChat.id)}</h3>
                    <p className={`text-xs ${isCalling ? "text-primary animate-pulse font-bold" : "text-green-400"}`}>
                      {isCalling ? "AI Calling Agent Active..." : "online"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isCalling ? (
                    <button 
                      onClick={handleCall}
                      className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 shadow-lg shadow-primary/5"
                      title="Initiate AI Voice Call"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                  ) : (
                    <button 
                      onClick={endCall}
                      className="p-3 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20 shadow-lg shadow-red-500/5"
                      title="End AI Voice Call"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  )
                  }
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                    <Bot className="w-4 h-4" /> AI Active
                  </div>
                  
                  {/* NEW REAL-TIME AI CALL BUTTON */}
                  <button 
                    onClick={() => setShowLiveCall(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 text-xs font-bold"
                  >
                    <Mic className="w-3.5 h-3.5" /> LIVE AI CALL
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
                {messages.length === 0 && (
                  <div className="text-center text-foreground/30 text-sm mt-8">No messages yet — send one or wait for a reply</div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.fromMe;
                  return (
                    <div key={msg.id + i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMe ? "bg-[#005c4b] text-white rounded-tr-sm" : "bg-[#202c33] text-foreground rounded-tl-sm"}`}>
                        
                        {msg.type === 'image' && msg.mediaData && (
                          <div className="mb-2 -mx-2 -mt-1 overflow-hidden shadow-lg">
                            <img 
                              src={msg.mediaData} 
                              alt="Shared photo" 
                              className="w-full h-auto max-h-[350px] min-w-[200px] object-cover rounded-t-xl cursor-pointer hover:opacity-95 transition-opacity" 
                            />
                          </div>
                        )}

                        {msg.type === 'audio' && (
                          <div className="py-2 min-w-[240px]">
                            <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider font-bold text-primary/80">
                              <Mic className="w-3 h-3" /> Voice Message
                            </div>
                            <audio controls className="w-full h-8 accent-primary mb-2">
                              <source src={msg.mediaData || `${BACKEND_URL}/api/audio/${msg.id}`} type="audio/ogg" />
                              Your browser does not support the audio element.
                            </audio>
                            {msg.text && (
                              <p className="text-[13px] italic text-white/70 border-t border-white/10 pt-2 leading-relaxed">
                                "{msg.text}"
                              </p>
                            )}
                          </div>
                        )}
                        
                        {msg.text && (
                          <div className="flex flex-col gap-1">
                            {msg.text.startsWith('[VOICE TRANSCRIPT]') && (
                              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-primary mb-1">
                                <Mic className="w-3 h-3" /> Voice Conversation
                              </div>
                            )}
                            <p className="text-[15px] leading-relaxed break-words">
                              {msg.text.replace('[VOICE TRANSCRIPT]: ', '').replace('[AI CALL STARTED]: ', '').replace('🎙️ [VOICE]: ', '')}
                            </p>
                          </div>
                        )}
                        
                        <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? "text-white/60" : "text-foreground/40"}`}>
                          <span className="text-[10px]">{formatTime(msg.timestamp)}</span>
                          {isMe && <CheckCheck className="w-3 h-3 text-blue-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-white/[0.02] border-t border-white/5 z-10">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={sending}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-white placeholder-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shrink-0 hover:bg-primary/80 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-5 h-5 ml-0.5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col text-foreground/30 gap-3">
              <Bot className="w-20 h-20 opacity-10 text-primary" />
              <p className="text-sm">Select a chat to start messaging</p>
            </div>
          )}
        </div>
      </div>

      <CallModal 
        isOpen={showLiveCall}
        onClose={() => setShowLiveCall(false)}
        contactName={selectedChat?.name || formatJid(selectedChat?.id || "")}
        contactJid={selectedChat?.id || ""}
        userId={user?.uid || ""}
      />
    </div>
  );
}
