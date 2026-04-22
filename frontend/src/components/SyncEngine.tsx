"use client";

import { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import io from 'socket.io-client';
import { useChatStore } from '@/store/chatStore';
import { performCatchupSync, syncInitialChatsFromServer } from '@/lib/syncManager';

const BACKEND_URL = "http://localhost:3001";

export function SyncEngine() {
  const [user] = useAuthState(auth);
  const addMessage = useChatStore(state => state.addMessage);
  const refreshChats = useChatStore(state => state.refreshChats);
  const setQrCode = useChatStore(state => state.setQrCode);
  const setConnecting = useChatStore(state => state.setConnecting);

  const refreshLeads = useChatStore(state => state.refreshLeads);

  useEffect(() => {
    if (!user) return;

    console.log("Starting Reliable Sync Engine for:", user.uid);
    
    // 1. Initial hydration from store/backend
    refreshChats();
    refreshLeads();

    const socket = io(BACKEND_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      console.log(`[SyncEngine] ✅ Connected to backend. Registering user: ${user.uid}`);
      socket.emit("register_user", user.uid);
      
      performCatchupSync(user.uid).then((hasItems) => {
        syncInitialChatsFromServer(user.uid).then((hasChats) => {
          if (hasItems || hasChats) {
              console.log("[SyncEngine] Initial sync complete. Refreshing UI.");
              refreshChats(); 
              refreshLeads();
          }
        });
      });
    });

    socket.on("connect_error", (err) => {
      console.error("[SyncEngine] ❌ Socket Connection Error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[SyncEngine] ⚠️ Socket disconnected:", reason);
    });

    socket.on("new_message", async (msg: any) => {
      console.log(`[SyncEngine] ⚡ Instant Push: ${msg.id} | From: ${msg.sender}`);
      try {
        await addMessage(msg);
      } catch (err) {
        console.error("[SyncEngine] ❌ Error in instant push:", err);
      }
    });

    socket.on("whatsapp_qr", (data) => {
      console.log("[SyncEngine] 📥 Received WhatsApp QR Code");
      setQrCode(data.qr);
      setConnecting(true);
    });

    socket.on("whatsapp_ready", async () => {
      console.log("[SyncEngine] ✨ WhatsApp instance ready for user:", user.uid);
      setQrCode("");
      setConnecting(false);
      await setDoc(doc(db, "users", user.uid), { whatsappConnected: true }, { merge: true });
      
      await syncInitialChatsFromServer(user.uid);
      refreshChats();
    });

    socket.on("sync_notification", () => {
      console.log("[SyncEngine] 🔄 Received background sync notification");
      performCatchupSync(user.uid).then(() => {
          refreshChats();
          refreshLeads();
      });
    });

    return () => {
      console.log("[SyncEngine] Cleaning up socket connection.");
      socket.disconnect();
    };
  }, [user, addMessage, refreshChats, setQrCode, setConnecting]);

  return null; // This is a headless component orchestrating sync
}
