"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Save, Bot, Key, Database, MessageSquare } from "lucide-react";

export default function SettingsPage() {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [aiSettings, setAiSettings] = useState({
    provider: "gemini",
    openAiKey: "",
    openRouterKey: "",
    geminiKey: "",
    systemPrompt: "You are a helpful WhatsApp assistant. Always be polite. Keep responses short.",
    welcomeMessage: "Hi there! How can I help you today?",
  });

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid, "settings", "ai");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAiSettings({ ...aiSettings, ...docSnap.data() });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    
    try {
      const docRef = doc(db, "users", user.uid, "settings", "ai");
      await setDoc(docRef, aiSettings, { merge: true });
      setMessage("Settings saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage("Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-foreground/50">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-12 h-auto flex flex-col pt-0 sm:pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">AI Configuration</h1>
        <p className="text-foreground/60 mt-2">Manage your AI agent behavior, API keys, and system prompts.</p>
      </div>

      <form onSubmit={saveSettings} className="space-y-8">
        {/* Core Settings */}
        <section className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">AI Engine</h2>
              <p className="text-sm text-foreground/50">Select your preferred AI provider</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground/80 mb-2">Primary Provider</label>
              <select 
                value={aiSettings.provider}
                onChange={(e) => setAiSettings({...aiSettings, provider: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="gemini">Gemini (Recommended)</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">API Keys</h2>
              <p className="text-sm text-foreground/50">Your own keys. Your own limits.</p>
            </div>
          </div>

          <div className="space-y-5">
            {aiSettings.provider === "gemini" && (
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">Google Gemini API Key</label>
                <input 
                  type="password"
                  value={aiSettings.geminiKey}
                  onChange={(e) => setAiSettings({...aiSettings, geminiKey: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="AIzaSy..."
                />
              </div>
            )}
            
            {aiSettings.provider === "openai" && (
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">OpenAI API Key</label>
                <input 
                  type="password"
                  value={aiSettings.openAiKey}
                  onChange={(e) => setAiSettings({...aiSettings, openAiKey: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="sk-proj-..."
                />
              </div>
            )}

            {aiSettings.provider === "openrouter" && (
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">OpenRouter API Key</label>
                <input 
                  type="password"
                  value={aiSettings.openRouterKey}
                  onChange={(e) => setAiSettings({...aiSettings, openRouterKey: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="sk-or-v1-..."
                />
              </div>
            )}
          </div>
        </section>

        {/* Behavior */}
        <section className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Agent Behavior</h2>
              <p className="text-sm text-foreground/50">Instruct the AI on how to handle your business.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">Welcome Message</label>
              <textarea 
                rows={2}
                value={aiSettings.welcomeMessage}
                onChange={(e) => setAiSettings({...aiSettings, welcomeMessage: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Sent immediately on first contact..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2 flex justify-between">
                <span>System Prompt / Brain</span>
                <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">Core Logic</span>
              </label>
              <textarea 
                rows={8}
                value={aiSettings.systemPrompt}
                onChange={(e) => setAiSettings({...aiSettings, systemPrompt: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono text-sm leading-relaxed"
                placeholder="You are an expert sales representative for AntigravityChat. Your goal is to capture the user's name and email..."
              />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-4 pt-4 sticky bottom-8 ml-auto w-fit">
          {message && (
            <span className={`text-sm ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </span>
          )}
          <button 
            type="submit"
            disabled={saving}
            className="btn-primary px-8 py-3.5 rounded-full font-semibold hover-lift flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
