"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Users, Bot, Zap, ArrowUpRight, QrCode, BarChart3 } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { useChatStore } from "@/store/chatStore";
import { QRCodeSVG } from "qrcode.react";

const BACKEND_URL = "https://whatsapp-701-production.up.railway.app";

export default function DashboardPage() {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState<any>(null);
  const [realStats, setRealStats] = useState({ messages: 0, aiResponses: 0, humanResponses: 0, leads: 0 });
  const [loading, setLoading] = useState(true);
  
  const [qrCode, setQrCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [qrExpired, setQrExpired] = useState(false);
  const [localDisconnect, setLocalDisconnect] = useState(false);
  
  useEffect(() => {
    if (!user) return;

    const socket = useChatStore.getState().socket;
    if (socket) {
      socket.on('whatsapp_qr', (data: { qr: string }) => {
        setQrCode(data.qr);
        setConnecting(true);
        setQrExpired(false);
        setLocalDisconnect(false); // Reset on new QR activity
      });

      socket.on('whatsapp_ready', () => {
        setConnecting(false);
        setQrCode("");
        setQrExpired(false);
        setLocalDisconnect(false); // Definitely connected
      });

      socket.on('whatsapp_status_update', (data: { status: string }) => {
        console.log(`[Socket] 📊 Status Update: ${data.status}`);
        if (data.status === 'disconnected') {
          setLocalDisconnect(true);
          setConnecting(false);
          setQrCode("");
          setQrExpired(false);
        }
      });

      socket.on('connection_status', (data: { isConnected: boolean }) => {
        console.log(`[Socket] 🔄 Connection Status Update: ${data.isConnected}`);
        if (!data.isConnected) {
          setLocalDisconnect(true);
          setConnecting(false);
          setQrCode("");
        } else {
          setLocalDisconnect(false);
        }
      });

      socket.on('whatsapp_disconnected', () => {
        setLocalDisconnect(true);
        setConnecting(false);
        setQrCode("");
        setQrExpired(false);
      });
    }

    return () => {
      if (socket) {
        socket.off('whatsapp_qr');
        socket.off('whatsapp_ready');
        socket.off('whatsapp_qr_expired');
        socket.off('whatsapp_disconnected');
        socket.off('whatsapp_status_update');
        socket.off('connection_status');
      }
    };
  }, [user]);

  const fetchRealStats = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setRealStats(data.totals);
      }
    } catch (err) {
      console.warn("Could not fetch real-time stats:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to user doc
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        // If Firestore now says disconnected, we can clear the local override
        if (data.whatsappConnected === false) {
          setLocalDisconnect(false);
        }
      }
      setLoading(false);
    });

    fetchRealStats();
    const interval = setInterval(fetchRealStats, 10000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    setQrCode("");
    setQrExpired(false);
    setLocalDisconnect(false);

    try {
      await fetch(`${BACKEND_URL}/api/whatsapp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
    } catch (error) {
      console.error("Failed to start WhatsApp connection trigger", error);
      setConnecting(false);
    }
  };

  if (loading) return <div className="text-foreground/50">Loading Dashboard...</div>;

  const isConnected = userData?.whatsappConnected === true && !localDisconnect;
  const stats = realStats;
  const hasData = stats.messages > 0;

  return (
    <div className="flex flex-col gap-8 h-full pb-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
        <p className="text-foreground/60 mt-1">
          {isConnected 
            ? "Monitor your WhatsApp AI agent performance today."
            : "Connect your WhatsApp to start automating."}
        </p>
      </div>

      {!isConnected ? (
        <div className="flex-1 glass-panel rounded-2xl border border-primary/20 flex flex-col items-center justify-center p-8 bg-primary/[0.02]">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <QrCode className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {qrExpired ? "QR Code Expired" : "Connect WhatsApp"}
          </h2>
          <p className="text-foreground/60 text-center max-w-md mb-8">
            {qrExpired 
              ? "The QR code has expired due to inactivity. Please regenerate it to connect." 
              : "Scan the QR code with your WhatsApp app to link your account. Your connection is secure."}
          </p>

          {connecting ? (
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
              {qrCode ? (
                <div className="flex flex-col items-center gap-4">
                  <QRCodeSVG value={qrCode} size={256} />
                  <p className="text-sm text-gray-500 font-medium animate-pulse">Scan with WhatsApp</p>
                </div>
              ) : (
                <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center">
                  <span className="text-gray-400 font-medium animate-pulse">Generating QR...</span>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={handleConnect}
              className="btn-primary px-8 py-4 rounded-full font-bold text-lg hover-lift shadow-lg shadow-primary/25"
            >
              {qrExpired ? "Regenerate QR Code" : "Generate QR Code"}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Messages" value={stats.messages} icon={MessageSquare}  />
            <StatCard title="AI Responses" value={stats.aiResponses} icon={Bot} highlight />
            <StatCard title="Human Responses" value={stats.humanResponses} icon={Users}  />
            <StatCard title="Total Leads Captured" value={stats.leads} icon={Zap} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 flex flex-col h-96">
              <h2 className="text-xl font-semibold text-white mb-6">Messages Overview</h2>
              <div className="flex-1 border border-white/5 border-dashed rounded-xl bg-white/[0.02] flex items-center justify-center">
                {hasData ? (
                  <span className="text-foreground/40 text-sm">Interactive Graph Will Load Here</span>
                ) : (
                  <div className="flex flex-col items-center text-foreground/40 gap-2">
                    <BarChart3 className="w-8 h-8 opacity-50" />
                    <span>No data yet. Waiting for messages.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col h-96">
              <h2 className="text-xl font-semibold text-white mb-6">Device Connection</h2>
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">WhatsApp API</p>
                    <p className="text-xs text-green-400 mt-0.5">Online & Active 24/7</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, highlight = false }: { title: string, value: number, icon: any, highlight?: boolean }) {
  return (
    <div className={`glass-panel p-6 rounded-2xl border ${highlight ? 'border-primary/30 shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-primary/[0.03]' : 'border-white/5'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${highlight ? 'bg-primary/20 text-primary' : 'bg-white/5 text-foreground/70'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h3 className="text-foreground/60 text-sm font-medium">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}
