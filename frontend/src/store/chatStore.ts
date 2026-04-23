import { create } from 'zustand';
import { auth } from '../lib/firebase';
import { saveMessageLocal, getAllChatsLocal, getMessagesForChatLocal } from '../lib/indexeddb';

interface Message {
  id: string;
  chatId: string;
  type: 'text' | 'image' | 'audio';
  text: string;
  mediaData?: string;
  fromMe: boolean;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Chat {
  id: string;
  name?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

interface ChatState {
  chats: Chat[];
  activeMessages: Message[];
  selectedChatId: string | null;
  qrCode: string;
  isConnecting: boolean;
  leads: any[];
  
  // Actions
  setChats: (chats: Chat[]) => void;
  selectChat: (chatId: string | null) => Promise<void>;
  addMessage: (msg: Message) => Promise<void>;
  refreshChats: () => Promise<void>;
  refreshLeads: () => Promise<void>;
  setQrCode: (qr: string) => void;
  setConnecting: (val: boolean) => void;
}

/**
 * Robust JID normalization for Phone-Number only matching.
 */
const normalizeJid = (jid: string | null | undefined) => {
  if (!jid) return null;
  return jid.split('@')[0];
};

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeMessages: [],
  selectedChatId: null,
  qrCode: "",
  isConnecting: false,
  leads: [],

  setChats: (chats) => set({ chats }),
  setQrCode: (qrCode) => set({ qrCode }),
  setConnecting: (isConnecting) => set({ isConnecting }),

  refreshLeads: async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const resp = await fetch(`http://localhost:3001/api/leads/${user.uid}`);
        if (resp.ok) set({ leads: await resp.json() });
    } catch (err) { console.warn("Store: Lead fetch error", err); }
  },

  selectChat: async (chatId) => {
    if (!chatId) {
      set({ selectedChatId: null, activeMessages: [] });
      return;
    }
    const normalizedId = normalizeJid(chatId);
    console.log(`[Store] 🎯 Selecting conversation: ${normalizedId}`);
    
    // 1. Clear current messages for clean transition
    set({ selectedChatId: chatId, activeMessages: [] });
    
    // 2. Load history from database
    const messages = await getMessagesForChatLocal(chatId);
    set({ activeMessages: messages as Message[] });
    
    // 3. Reset unread count
    set(state => ({
      chats: state.chats.map(c => normalizeJid(c.id) === normalizedId ? { ...c, unreadCount: 0 } : c)
    }));
  },

  addMessage: async (msg) => {
    const incomingJid = msg.chatId;
    const normalizedIncoming = normalizeJid(incomingJid);
    
    // 🔥 STEP 1: INSTANT REACTIVE UI UPDATE (Synchronous)
    // We update the UI before the message even hits the database.
    set(state => {
      const normalizedSelected = normalizeJid(state.selectedChatId);
      const isForActiveChat = normalizedSelected && normalizedIncoming && (normalizedSelected === normalizedIncoming);
      
      const lastMsgText = msg.type === 'image' ? 'photo' : (msg.type === 'audio' ? 'Voice message' : msg.text);

      // --- Update Active Messages Window ---
      let newActiveMessages = state.activeMessages;
      if (isForActiveChat) {
        // Robust Deduplication: Check for duplicate ID OR exact same content+time
        const isInternalDuplicate = state.activeMessages.some(m => 
          m.id === msg.id || 
          (m.text === msg.text && Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
        );
        
        if (!isInternalDuplicate) {
          console.log(`[Store] 🚀 Pushing new message to Active Chat: ${normalizedIncoming}`);
          newActiveMessages = [...state.activeMessages, msg];
        }
      }

      // --- Update Chat List Sidebar ---
      const existingIndex = state.chats.findIndex(c => normalizeJid(c.id) === normalizedIncoming);
      let updatedChats = [...state.chats];

      if (existingIndex !== -1) {
        const existing = updatedChats[existingIndex];
        updatedChats[existingIndex] = {
          ...existing,
          id: incomingJid, // Keep full JID updated
          lastMessage: lastMsgText,
          lastMessageTime: msg.timestamp,
          unreadCount: isForActiveChat ? 0 : existing.unreadCount + (msg.fromMe ? 0 : 1)
        };
      } else {
        updatedChats.unshift({
          id: incomingJid,
          lastMessage: lastMsgText,
          lastMessageTime: msg.timestamp,
          unreadCount: msg.fromMe ? 0 : 1
        });
      }

      // Sort sidebar by most recent
      updatedChats.sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());

      return {
        chats: updatedChats,
        activeMessages: newActiveMessages
      };
    });

    // 🔥 STEP 2: BACKGROUND PERSISTENCE (Asynchronous)
    // We save to IndexedDB in the background so it doesn't block the UI.
    try {
      await saveMessageLocal(msg);
    } catch (err) {
      console.warn("[Store] ⚠️ Persistence failed in background", err);
    }
  },

  refreshChats: async () => {
    // Background sync - reload everything from DB
    const savedChats = await getAllChatsLocal();
    const { selectedChatId } = get();
    
    let freshMessages: Message[] = [];
    if (selectedChatId) {
      freshMessages = await getMessagesForChatLocal(selectedChatId) as Message[];
    }

    set({ 
      chats: savedChats as Chat[],
      activeMessages: selectedChatId ? freshMessages : get().activeMessages 
    });
  }
}));
