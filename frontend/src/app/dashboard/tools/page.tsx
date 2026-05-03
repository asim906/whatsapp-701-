"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Zap, Users, Upload, Send, Clock, AlertTriangle, CheckCircle2, XCircle, Search, Trash2, ChevronRight, FileText } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { auth } from "@/lib/firebase";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Contact {
  id: string;
  name: string;
  phone: string;
  source: 'chat' | 'imported';
}

interface SendResult {
  contact: Contact;
  status: 'success' | 'failed';
  error?: string;
}

const BACKEND_URL = "https://whatsapp-701-production.up.railway.app";

export default function ToolsPage() {
  const { chats, refreshChats } = useChatStore();
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(3);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [status, setStatus] = useState<"idle" | "preview" | "sending" | "done">("idle");
  const [importPreview, setImportPreview] = useState<Contact[]>([]);
  const [results, setResults] = useState<SendResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshChats();
  }, []);

  // Merge real chats with imported contacts
  const allContacts = useMemo(() => {
    const chatContacts: Contact[] = chats.map(c => ({
      id: c.id,
      name: c.name || c.id.split('@')[0],
      phone: c.id.split('@')[0],
      source: 'chat'
    }));

    // Deduplicate by phone number
    const seen = new Set(chatContacts.map(c => c.phone));
    const uniqueImported = importedContacts.filter(c => {
      if (seen.has(c.phone)) return false;
      seen.add(c.phone);
      return true;
    });

    return [...chatContacts, ...uniqueImported];
  }, [chats, importedContacts]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return allContacts;
    const q = searchQuery.toLowerCase();
    return allContacts.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    );
  }, [allContacts, searchQuery]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c.id));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const ext = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      let parsedData: any[] = [];

      if (ext === 'csv') {
        const result = Papa.parse(data as string, { header: true });
        parsedData = result.data;
      } else {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        parsedData = XLSX.utils.sheet_to_json(sheet);
      }

      const newContacts: Contact[] = parsedData
        .map((row: any, index) => {
          const name = row.name || row.Name || row.contact || row.Contact || `Contact ${index + 1}`;
          let phone = String(row.phone || row.Phone || row.number || row.Number || "").replace(/\D/g, '');
          
          if (!phone) return null;
          if (!phone.startsWith('+')) phone = '+' + phone;

          return {
            id: `imported_${Date.now()}_${index}`,
            name,
            phone,
            source: 'imported' as const
          };
        })
        .filter(Boolean) as Contact[];

      if (newContacts.length > 0) {
        setImportPreview(newContacts);
        setStatus("preview");
      }
      if (fileRef.current) fileRef.current.value = "";
    };

    if (ext === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const confirmImport = () => {
    setImportedContacts(prev => [...prev, ...importPreview]);
    setImportPreview([]);
    setStatus("idle");
  };

  const startBulkSend = async () => {
    if (!message.trim() || selectedIds.length === 0) return;
    
    setStatus("sending");
    setResults([]);
    setCurrentIndex(0);
    
    const user = auth.currentUser;
    if (!user) return;

    const toSend = allContacts.filter(c => selectedIds.includes(c.id));

    for (let i = 0; i < toSend.length; i++) {
      const contact = toSend[i];
      setCurrentIndex(i + 1);

      try {
        const jid = contact.id.includes('@') ? contact.id : `${contact.phone.replace('+', '')}@s.whatsapp.net`;
        const resp = await fetch(`${BACKEND_URL}/api/whatsapp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            jid,
            text: message.replace(/{name}/g, contact.name)
          }),
        });

        if (resp.ok) {
          setResults(prev => [...prev, { contact, status: 'success' }]);
        } else {
          const errData = await resp.json();
          setResults(prev => [...prev, { contact, status: 'failed', error: errData.error || "Delivery failed" }]);
        }
      } catch (err: any) {
        setResults(prev => [...prev, { contact, status: 'failed', error: err.message }]);
      }

      if (i < toSend.length - 1) {
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    setStatus("done");
  };

  const clearSelected = () => setSelectedIds([]);
  const clearImported = () => {
    setImportedContacts([]);
    setSelectedIds(prev => prev.filter(id => !id.startsWith('imported_')));
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Bulk Messaging</h1>
          <p className="text-foreground/60 mt-1">Select real contacts or import sheets to start a campaign.</p>
        </div>
        {status === "done" && (
          <button onClick={() => setStatus("idle")} className="btn-secondary px-4 py-2 rounded-xl text-sm">
            Start New Campaign
          </button>
        )}
      </div>

      {status === "preview" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-4">Preview Imported Contacts</h2>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-white/5 mb-6">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-background/80 backdrop-blur-md">
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-xs font-semibold text-foreground/50 uppercase">Name</th>
                    <th className="p-4 text-xs font-semibold text-foreground/50 uppercase">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((c, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="p-4 text-sm text-white">{c.name}</td>
                      <td className="p-4 text-sm text-foreground/60">{c.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4">
              <button onClick={confirmImport} className="flex-1 btn-primary py-3 rounded-xl font-bold">
                Confirm & Add {importPreview.length} Contacts
              </button>
              <button onClick={() => { setImportPreview([]); setStatus("idle"); }} className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "done" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-panel rounded-2xl border border-white/5 p-8 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Campaign Complete</h2>
            <p className="text-foreground/60 mb-8 max-w-xs">
              Bulk message has been processed. Check the detailed report below.
            </p>
            <div className="grid grid-cols-3 gap-8 w-full max-w-sm">
              <div>
                <p className="text-3xl font-bold text-white">{results.length}</p>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mt-1">Total</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-400">{successCount}</p>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mt-1">Success</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-400">{failedCount}</p>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mt-1">Failed</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Delivery Report
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${
                  r.status === 'success' ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    r.status === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {r.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{r.contact.name}</p>
                    <p className="text-xs text-foreground/40">{r.contact.phone}</p>
                  </div>
                  {r.status === 'failed' && (
                    <p className="text-[10px] font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-md max-w-[100px] truncate">
                      {r.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)] min-h-[600px]">
          {/* Contacts Sidebar */}
          <div className="flex flex-col gap-4 glass-panel rounded-2xl border border-white/5 p-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Recipient Selection
              </h2>
              <div className="flex gap-3">
                <button onClick={selectAll} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  {selectedIds.length === filteredContacts.length && filteredContacts.length > 0 ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
              <input 
                type="text" 
                placeholder="Search name or number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
              {filteredContacts.length > 0 ? (
                filteredContacts.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => toggleSelect(c.id)}
                    className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer select-none transition-all border ${
                      selectedIds.includes(c.id)
                        ? "bg-primary/10 border-primary/20 text-white shadow-inner"
                        : "border-transparent hover:bg-white/[0.03] text-foreground/70"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                      selectedIds.includes(c.id) ? "bg-primary border-primary" : "border-white/20 group-hover:border-white/40"
                    }`}>
                      {selectedIds.includes(c.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-foreground/30 font-mono">{c.phone}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter ${
                          c.source === 'chat' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {c.source}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-foreground/10 transition-transform ${selectedIds.includes(c.id) ? 'rotate-90 text-primary/40' : ''}`} />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-20">
                  <Users className="w-12 h-12 mb-2" />
                  <p className="text-sm">No contacts found</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs text-foreground/40 font-medium">{importedContacts.length} Imported Contacts</span>
                {importedContacts.length > 0 && (
                  <button onClick={clearImported} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                    <Trash2 className="w-3 h-3" /> Clear List
                  </button>
                )}
              </div>
              <button 
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white/[0.02] border border-dashed border-white/10 rounded-xl text-foreground/60 hover:text-white hover:border-white/30 hover:bg-white/[0.05] transition-all text-sm font-medium"
              >
                <Upload className="w-4 h-4" /> Import Excel / CSV
              </button>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </div>
          </div>

          {/* Message Content Panel */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="glass-panel flex-1 rounded-2xl border border-white/5 p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <Zap className="w-6 h-6 text-primary" /> Compose Content
                </h2>
                <div className="flex items-center gap-4 text-xs text-foreground/40">
                   <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                     Personalization Enabled
                   </div>
                </div>
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message here...&#10;&#10;Pro tip: Use {name} to automatically insert the recipient's name!&#10;Example: Hello {name}, how are you today?"
                className="flex-1 w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-5 text-lg text-white placeholder-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-semibold text-white">Anti-Ban Delay</p>
                      <span className="text-xs text-yellow-400 font-mono font-bold">{delay}s</span>
                    </div>
                    <input 
                      type="range" 
                      min={1} 
                      max={20} 
                      value={delay} 
                      onChange={e => setDelay(+e.target.value)}
                      className="w-full accent-primary h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" 
                    />
                    <p className="text-[10px] text-foreground/40 mt-2">Recommended: 3s - 8s for safety</p>
                  </div>
                </div>

                <div className={`rounded-2xl p-5 flex items-center gap-5 border transition-all ${
                  selectedIds.length > 0 ? 'bg-primary/5 border-primary/20' : 'bg-white/[0.02] border-white/5 opacity-40'
                }`}>
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Send className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Sending Summary</p>
                    <p className="text-xs text-foreground/50 mt-0.5">
                      {selectedIds.length > 0 
                        ? `To ${selectedIds.length} recipients in ~${selectedIds.length * delay}s`
                        : "Select recipients to continue"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={startBulkSend}
              disabled={!message.trim() || selectedIds.length === 0 || status === "sending"}
              className="group relative btn-primary py-5 rounded-2xl font-bold text-lg overflow-hidden disabled:opacity-40 shadow-xl shadow-primary/20"
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                {status === "sending" ? (
                   <>
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     <span>Processing {currentIndex} of {selectedIds.length}...</span>
                   </>
                ) : (
                  <>
                    <Send className="w-6 h-6 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    <span>Blast Message to {selectedIds.length} Contacts</span>
                  </>
                )}
              </div>
              {status === "sending" && (
                <div 
                  className="absolute inset-0 bg-white/10 transition-all duration-500 ease-out"
                  style={{ width: `${(currentIndex / selectedIds.length) * 100}%` }}
                />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
