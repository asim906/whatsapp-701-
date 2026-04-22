import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { activeUsers } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/users');

export interface SyncItem {
  id: string; // msg id, lead id, etc.
  type: 'message' | 'lead' | 'analytics';
  data: any;
  timestamp: string;
}

export class SyncService {
  private static io: Server;

  static init(io: Server) {
    this.io = io;
  }
  private static getFilePath(userId: string) {
    const userDir = path.join(DATA_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, 'offline_sync.json');
  }

  static isUserOnline(userId: string): boolean {
    if (!this.io) return false;
    
    // 1. Check our explicit registration map (Primary)
    if (activeUsers.has(userId)) return true;

    // 2. Fallback to room size check
    const room = this.io.sockets.adapter.rooms.get(`user_${userId}`);
    return room !== undefined && room.size > 0;
  }

  static async getPending(userId: string): Promise<SyncItem[]> {
    const filePath = this.getFilePath(userId);
    if (!fs.existsSync(filePath)) return [];
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading sync buffer for ${userId}:`, err);
      return [];
    }
  }

  static async addToBuffer(userId: string, type: SyncItem['type'], data: any) {
    const pending = await this.getPending(userId);
    
    // Avoid duplicates
    if (pending.find(item => item.id === data.id)) return;

    pending.push({
      id: data.id,
      type,
      data,
      timestamp: new Date().toISOString()
    });

    this.saveSync(userId, pending);
    console.log(`[Sync] 📥 User ${userId} is OFFLINE. Record added to buffer (${type})`);
  }

  static async acknowledge(userId: string, ids: string[]) {
    const pending = await this.getPending(userId);
    const filtered = pending.filter(item => !ids.includes(item.id));
    this.saveSync(userId, filtered);
    console.log(`[Sync] ✅ Sync Acknowledged for ${userId}. Cleared ${ids.length} items.`);
  }

  private static saveSync(userId: string, data: SyncItem[]) {
    const filePath = this.getFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Error writing sync buffer for ${userId}:`, err);
    }
  }
}
