"use client";

import { useState, useRef } from "react";
import { Zap, Users, Upload, Send, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

const DEMO_CONTACTS = [
  { id: "1", name: "Ahmed Khan", phone: "+923001234567" },
  { id: "2", name: "Sara Malik", phone: "+923219876543" },
  { id: "3", name: "Usman Ali", phone: "+923335554443" },
];

export default function ToolsPage() {
  const [contacts] = useState(DEMO_CONTACTS);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(3);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [sentCount, setSentCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () =>
    setSelected(selected.length === contacts.length ? [] : contacts.map(c => c.id));

  const simulateSend = async () => {
    if (!message.trim() || selected.length === 0) return;
    setStatus("sending");
    setSentCount(0);
    for (let i = 0; i < selected.length; i++) {
      await new Promise(r => setTimeout(r, delay * 1000));
      setSentCount(i + 1);
    }
    setStatus("done");
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Tools & Bulk Messaging</h1>
        <p className="text-foreground/60 mt-1">Send bulk messages with intelligent anti-ban delays.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts Panel */}
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />Contacts
            </h2>
            <button onClick={selectAll} className="text-xs text-primary hover:text-primary/80 font-medium">
              {selected.length === contacts.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {contacts.map(c => (
              <div key={c.id} onClick={() => toggleSelect(c.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer select-none transition-all border ${
                  selected.includes(c.id)
                    ? "bg-primary/10 border-primary/20 text-white"
                    : "border-transparent hover:bg-white/5 text-foreground/70"
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  selected.includes(c.id) ? "bg-primary border-primary" : "border-white/20"
                }`}>
                  {selected.includes(c.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <p className="text-xs text-foreground/40">{c.phone}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-white/10 rounded-xl text-foreground/50 hover:text-white hover:border-white/30 transition-colors text-sm">
            <Upload className="w-4 h-4" /> Import from Excel
          </button>
          <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" />
        </div>

        {/* Message Panel */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/5 p-6 flex flex-col gap-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />Compose Bulk Message
          </h2>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            placeholder="Type your message here...&#10;&#10;You can use {name} to personalize!"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />

          <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Anti-Ban Delay</p>
              <p className="text-xs text-foreground/50">Wait between each message to avoid WhatsApp ban</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={15} value={delay} onChange={e => setDelay(+e.target.value)}
                className="w-24 accent-primary" />
              <span className="text-sm text-white font-semibold w-12 text-right">{delay}s</span>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 px-4 py-3 rounded-xl border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Sending to {selected.length} contacts. Estimated time: ~{selected.length * delay}s
            </div>
          )}

          {status === "sending" && (
            <div>
              <div className="flex justify-between text-sm text-foreground/60 mb-2">
                <span>Sending...</span>
                <span>{sentCount} / {selected.length}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(sentCount / selected.length) * 100}%` }} />
              </div>
            </div>
          )}

          {status === "done" && (
            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-3 rounded-xl border border-green-500/20 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Successfully sent to {sentCount} contacts!
            </div>
          )}

          <button
            onClick={simulateSend}
            disabled={!message.trim() || selected.length === 0 || status === "sending"}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
          >
            <Send className="w-5 h-5" />
            {status === "sending" ? "Sending..." : `Send to ${selected.length} Contacts`}
          </button>
        </div>
      </div>
    </div>
  );
}
