import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface WhatsAppDB extends DBSchema {
  chats: {
    key: string;
    value: {
      id: string;      // The Jid of the contact
      name?: string;
      lastMessage?: string;
      lastMessageTime?: string;
      unreadCount: number;
    };
  };
  messages: {
    key: string;
    value: {
      id: string; // The message ID
      chatId: string; // The Jid of the contact
      type: 'text' | 'image' | 'audio';
      text: string;
      mediaData?: string; // base64
      fromMe: boolean;
      timestamp: string;
      status?: 'sent' | 'delivered' | 'read';
    };
    indexes: { 'by-chat': string };
  };
  leads: {
    key: string;
    value: {
      id: string;
      phone: string;
      name?: string;
      email?: string;
      createdAt: string;
    }
  }
}

let dbPromise: Promise<IDBPDatabase<WhatsAppDB>> | null = null;

export const getDB = () => {
  if (typeof window === 'undefined') return null;
  
  if (!dbPromise) {
    dbPromise = openDB<WhatsAppDB>('WA_SaaS_DB', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('chats')) {
            db.createObjectStore('chats', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('messages')) {
            const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
            msgStore.createIndex('by-chat', 'chatId');
          }
          if (!db.objectStoreNames.contains('leads')) {
            db.createObjectStore('leads', { keyPath: 'id' });
          }
        }
        // Version 3: Ensures 'audio' type is supported in runtime logic, 
        // IDB is schema-less for records but we increment version to force a refresh of any stale connections.
      },
    });
  }
  return dbPromise;
};

// --- Helpers ---

export const getAllChatsLocal = async () => {
  const db = await getDB();
  if (!db) return [];
  try {
    const chats = await db.getAll('chats');
    return chats.sort((a, b) => {
      const timeA = new Date(a.lastMessageTime || 0).getTime();
      const timeB = new Date(b.lastMessageTime || 0).getTime();
      return timeB - timeA;
    });
  } catch (err) {
    console.error("IDB: Failed to get chats", err);
    return [];
  }
};

export const getMessagesForChatLocal = async (chatId: string) => {
  const db = await getDB();
  if (!db) return [];
  try {
    const messages = await db.getAllFromIndex('messages', 'by-chat', chatId);
    return messages.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  } catch (err) {
    console.error(`IDB: Failed to get messages for ${chatId}`, err);
    return [];
  }
};

export const saveMessageLocal = async (message: any) => {
  const db = await getDB();
  if (!db) return;
  
  try {
    const tx = db.transaction(['messages', 'chats'], 'readwrite');
    
    // Save message
    await tx.objectStore('messages').put({
      id: message.id,
      chatId: message.chatId,
      type: message.type || 'text',
      text: message.text || "",
      mediaData: message.mediaData,
      fromMe: message.fromMe,
      timestamp: message.timestamp,
    });

    // Update chat
    const chatStore = tx.objectStore('chats');
    let chat = await chatStore.get(message.chatId);
    if (!chat) {
      chat = {
        id: message.chatId,
        unreadCount: message.fromMe ? 0 : 1,
        lastMessage: message.text || (message.type === 'image' ? 'photo' : (message.type === 'audio' ? 'Voice note' : '')),
        lastMessageTime: message.timestamp,
      };
    } else {
      chat.lastMessage = message.text || (message.type === 'image' ? 'photo' : (message.type === 'audio' ? 'Voice note' : ''));
      chat.lastMessageTime = message.timestamp;
      if (!message.fromMe) chat.unreadCount += 1;
    }
    await chatStore.put(chat);
    
    await tx.done;
  } catch (err) {
    console.error("IDB: Failed to save message", err);
  }
};

export const saveLeadLocal = async (lead: any) => {
  const db = await getDB();
  if (!db) return;
  try {
    await db.put('leads', {
      id: lead.id,
      phone: lead.phone,
      name: lead.name,
      email: lead.email,
      createdAt: lead.createdAt
    });
  } catch (err) {
    console.error("IDB: Failed to save lead", err);
  }
};

export const saveChatsBulkLocal = async (chats: any[]) => {
  const db = await getDB();
  if (!db) return;
  try {
    const tx = db.transaction('chats', 'readwrite');
    const store = tx.objectStore('chats');
    for (const chat of chats) {
      await store.put(chat);
    }
    await tx.done;
  } catch (err) {
    console.error("IDB: Failed to bulk save chats", err);
  }
};
