import { saveMessageLocal, saveLeadLocal, saveChatsBulkLocal } from './indexeddb';

const BACKEND_URL = "http://localhost:3001";

export async function syncInitialChatsFromServer(userId: string) {
  const url = `${BACKEND_URL}/api/whatsapp/chats/${userId}`;
  console.log(`[Sync] 🔍 Fetching initial chats and contacts from: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Sync] ❌ Failed to fetch chats (Status: ${res.status})`);
      return false;
    }

    const chats = await res.json();
    if (chats && chats.length > 0) {
      console.log(`[Sync] 📥 Syncing ${chats.length} active chats from history...`);
      await saveChatsBulkLocal(chats);
      console.log(`[Sync] ✅ Successfully saved chats to local DB.`);
      return true;
    } else {
      console.log(`[Sync] ℹ️ No active chats found for this user in backend history.`);
      return false;
    }
  } catch (err) {
    console.error(`[Sync] ❌ Network error during initial chat sync:`, err);
    return false;
  }
}

export async function performCatchupSync(userId: string) {
  console.log(`[Sync] Starting catchup sync for ${userId}...`);
  try {
    const res = await fetch(`${BACKEND_URL}/api/sync/catchup/${userId}`);
    if (!res.ok) return;

    const pendingItems = await res.json();
    if (pendingItems.length === 0) {
      console.log(`[Sync] No pending items to catch up.`);
      return;
    }

    console.log(`[Sync] Processing ${pendingItems.length} pending items...`);
    const successfulIds: string[] = [];

    for (const item of pendingItems) {
      try {
        if (item.type === 'message') {
          // saveMessageLocal handles both chats and messages stores
          await saveMessageLocal(item.data);
          successfulIds.push(item.id);
        } else if (item.type === 'lead') {
          await saveLeadLocal(item.data);
          successfulIds.push(item.id);
        }
      } catch (err) {
        console.error(`[Sync] Failed to store item ${item.id}:`, err);
      }
    }

    if (successfulIds.length > 0) {
      // Acknowledge back to backend
      const ackRes = await fetch(`${BACKEND_URL}/api/sync/acknowledge/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: successfulIds })
      });
      
      if (ackRes.ok) {
        console.log(`[Sync] Successfully acknowledged ${successfulIds.length} items.`);
      }
    }
    
    // Trigger a UI refresh page-wide if needed
    return true;
  } catch (err) {
    console.error(`[Sync] Connection error during catchup:`, err);
    return false;
  }
}
