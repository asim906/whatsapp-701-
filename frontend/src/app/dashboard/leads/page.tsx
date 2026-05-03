"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Download, Trash2, Search, Tag, Settings2, GripVertical, Check, X } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { motion, Reorder, AnimatePresence } from "framer-motion";

interface ColumnConfig {
  id: string;
  label: string;
  isVisible: boolean;
}

import { useChatStore } from "@/store/chatStore";

const BACKEND_URL = "https://whatsapp-701-production.up.railway.app";

export default function LeadsPage() {
  const [user] = useAuthState(auth);
  const leads = useChatStore(state => state.leads);
  const refreshLeads = useChatStore(state => state.refreshLeads);
  
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showManageCols, setShowManageCols] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", tag: "" });
  const [newColLabel, setNewColLabel] = useState("");

  const fetchInitialData = async () => {
    if (!user) return;
    try {
      await refreshLeads();
      
      const confResp = await fetch(`${BACKEND_URL}/api/leads/settings/${user.uid}`);
      if (confResp.ok) setColumns(await confResp.json());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, [user]);

  const saveConfig = async (newCols: ColumnConfig[]) => {
    setColumns(newCols);
    if (!user) return;
    try {
      await fetch(`${BACKEND_URL}/api/leads/settings/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCols),
      });
    } catch (err) {
      console.error("Config save error:", err);
    }
  };

  const addColumn = () => {
    if (!newColLabel.trim()) return;
    const id = newColLabel.toLowerCase().replace(/\s+/g, "_");
    if (columns.find(c => c.id === id)) return;
    const updated = [...columns, { id, label: newColLabel, isVisible: true }];
    saveConfig(updated);
    setNewColLabel("");
  };

  const removeColumn = (id: string) => {
    const updated = columns.filter(c => c.id !== id);
    saveConfig(updated);
  };

  const toggleVisibility = (id: string) => {
    const updated = columns.map(c => c.id === id ? { ...c, isVisible: !c.isVisible } : c);
    saveConfig(updated);
  };

  const addLead = async () => {
    if (!newLead.phone || !user) return;
    const leadData = { 
      ...newLead, 
      id: Date.now().toString(), 
      createdAt: new Date().toISOString().split("T")[0],
      details: {} 
    };
    try {
      const res = await fetch(`${BACKEND_URL}/api/leads/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadData),
      });
      if (res.ok) {
        await refreshLeads();
        setNewLead({ name: "", phone: "", email: "", tag: "" });
        setShowAdd(false);
      }
    } catch (err) { console.error(err); }
  };

  const deleteLead = async (leadId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/leads/${user.uid}/${leadId}`, { method: "DELETE" });
      if (res.ok) await refreshLeads();
    } catch (err) { console.error(err); }
  };

  const updateLeadDetail = async (leadId: string, colId: string, val: string) => {
    if (!user) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    let updatedLead;
    const standardKeys = ["name", "phone", "email", "tag", "createdAt"];
    
    if (standardKeys.includes(colId)) {
        updatedLead = { ...lead, [colId]: val };
    } else {
        updatedLead = { ...lead, details: { ...(lead.details || {}), [colId]: val } };
    }

    
    try {
      await fetch(`${BACKEND_URL}/api/leads/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedLead),
      });
      await refreshLeads();
    } catch (err) { console.error(err); }
  };

  const getCellValue = (lead: any, colId: string) => {
    if (lead[colId] !== undefined) return lead[colId];
    return lead.details?.[colId] || "";
  };

  const visibleCols = columns.filter(c => c.isVisible);

  const filtered = leads.filter(l => {
    const searchStr = `${l.name} ${l.phone} ${l.email} ${Object.values(l.details || {}).join(" ")}`.toLowerCase();
    return searchStr.includes(search.toLowerCase());
  });

  const exportCSV = () => {
    const headers = visibleCols.map(c => c.label);
    const rows = filtered.map(l => visibleCols.map(c => getCellValue(l, c.id)));
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
  };

  const tagColor: Record<string, string> = {
    "Hot Lead": "bg-red-500/15 text-red-400 border-red-500/20",
    "Interested": "bg-green-500/15 text-green-400 border-green-500/20",
    "Follow Up": "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Leads Dashboard</h1>
          <p className="text-foreground/60 mt-1">Manage, capture, and dispatch orders with full flexibility.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManageCols(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium">
            <Settings2 className="w-4 h-4" /> Manage Columns
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: leads.length },
          { label: "Hot Leads", value: leads.filter(l => l.tag === "Hot Lead").length },
          { label: "Interested", value: leads.filter(l => l.tag === "Interested").length },
          { label: "Orders/FollowUp", value: leads.filter(l => l.tag === "Follow Up").length },
        ].map((s, i) => (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            key={i} className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/[0.02]">
            <p className="text-foreground/50 text-xs font-medium uppercase tracking-wider">{s.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leads, products, or order details..."
            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xl"
          />
        </div>
      </div>

      {/* Manage Columns Modal */}
      <AnimatePresence>
        {showManageCols && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative">
              <button onClick={() => setShowManageCols(false)} className="absolute top-6 right-6 text-foreground/40 hover:text-white"><X className="w-5 h-5"/></button>
              <h3 className="text-xl font-bold text-white mb-2">Column Settings</h3>
              <p className="text-sm text-foreground/50 mb-6">Drag to reorder your dashboard columns.</p>
              
              <Reorder.Group axis="y" values={columns} onReorder={saveConfig} className="space-y-2 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {columns.map(col => (
                  <Reorder.Item key={col.id} value={col} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl group hover:border-white/20 transition-all cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-foreground/30 group-hover:text-foreground/60 transition-colors" />
                    <span className="flex-1 text-sm font-medium text-white/80">{col.label}</span>
                    <button onClick={() => toggleVisibility(col.id)} className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest transition-colors ${col.isVisible ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-foreground/40 border border-white/5'}`}>
                      {col.isVisible ? 'Visible' : 'Hidden'}
                    </button>
                    {!["name", "phone", "email", "createdAt"].includes(col.id) && (
                      <button onClick={() => removeColumn(col.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    )}
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <div className="flex gap-2">
                <input value={newColLabel} onChange={e => setNewColLabel(e.target.value)} placeholder="New Column (e.g. Hotel)" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                <button onClick={addColumn} className="btn-primary px-4 py-2 rounded-xl text-sm font-medium">Add</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Lead UI */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-panel border border-primary/20 rounded-3xl p-8 bg-primary/[0.02] shadow-inner mb-6">
          <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Create Manual Lead
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { placeholder: "Full Name", key: "name", type: "text" },
              { placeholder: "Phone Number *", key: "phone", type: "tel" },
              { placeholder: "Email Address", key: "email", type: "email" },
              { placeholder: "Initial Tag", key: "tag", type: "text" },
            ].map(f => (
              <input key={f.key} type={f.type} placeholder={f.placeholder}
                value={(newLead as any)[f.key]}
                onChange={e => setNewLead({ ...newLead, [f.key]: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
              />
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={addLead} className="btn-primary px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20">Create Lead</button>
            <button onClick={() => setShowAdd(false)} className="px-8 py-3 rounded-2xl border border-white/10 text-white hover:bg-white/5 font-bold text-sm transition-all">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Leads Table */}
      <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl bg-white/[0.01]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {visibleCols.map(col => (
                  <th key={col.id} className="px-6 py-5 text-foreground/40 font-bold uppercase tracking-wider text-left min-w-[150px]">
                    {col.label}
                  </th>
                ))}
                <th className="px-6 py-5 text-foreground/40 font-bold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={visibleCols.length + 1} className="text-center py-20 text-foreground/30">Loading your data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={visibleCols.length + 1} className="text-center py-24 text-foreground/30">
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium opacity-50">No leads found in this view</p>
                    <p className="text-sm opacity-30 mt-1">Try a different search or add a manual lead.</p>
                  </motion.div>
                </td></tr>
              ) : filtered.map((lead, idx) => (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }}
                  key={lead.id} className="group border-b border-white/5 hover:bg-white/[0.03] transition-all relative">
                  {visibleCols.map(col => (
                    <td key={col.id} className="px-6 py-4.5">
                      {col.id === 'tag' ? (
                         <div className="flex items-center">
                            <input
                                value={getCellValue(lead, col.id)}
                                onChange={e => updateLeadDetail(lead.id, col.id, e.target.value)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 ${tagColor[lead.tag] || "text-white border-white/10"}`}
                             />
                         </div>
                      ) : (
                        <div className="flex items-center group/cell">
                          <input
                            value={getCellValue(lead, col.id)}
                            onChange={e => updateLeadDetail(lead.id, col.id, e.target.value)}
                            className="bg-transparent border-none text-white w-full focus:outline-none focus:ring-1 focus:ring-primary/30 py-1 rounded placeholder-foreground/20 leading-relaxed transition-all"
                            placeholder="..."
                          />
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4.5 text-center">
                    <button onClick={() => deleteLead(lead.id)} className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-500 transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100">
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
