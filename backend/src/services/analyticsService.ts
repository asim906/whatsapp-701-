import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminDb } from '../config/firebase-admin.js';
import { LeadService } from './leadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/users');

export interface DailyStats {
  messages: number;
  aiResponses: number;
  humanResponses: number;
  leads: number;
}

export interface AnalyticsData {
  totals: DailyStats;
  daily: {
    [date: string]: DailyStats;
  };
}

const EMPTY_STATS = () => ({
  messages: 0,
  aiResponses: 0,
  humanResponses: 0,
  leads: 0
});

export class AnalyticsService {
  private static getFilePath(userId: string) {
    const userDir = path.join(DATA_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, 'analytics.json');
  }

  static async getStats(userId: string): Promise<AnalyticsData> {
    const filePath = this.getFilePath(userId);
    if (!fs.existsSync(filePath)) {
      const initial = { totals: EMPTY_STATS(), daily: {} };
      // Auto-trigger sync on first read
      await this.syncAll(userId, initial);
      return initial;
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading analytics for ${userId}:`, err);
      return { totals: EMPTY_STATS(), daily: {} };
    }
  }

  static async trackEvent(userId: string, type: keyof DailyStats) {
    const data = await this.getStats(userId);
    const today = new Date().toISOString().split('T')[0];

    // Update Totals
    data.totals[type] = (data.totals[type] || 0) + 1;

    // Update Daily
    if (!data.daily[today]) {
      data.daily[today] = EMPTY_STATS();
    }
    data.daily[today][type] = (data.daily[today][type] || 0) + 1;

    // Save
    this.saveStats(userId, data);
  }

  static async syncAll(userId: string, existingData?: AnalyticsData) {
    console.log(`[${userId}] 🔄 Starting Analytics Sync...`);
    const data = existingData || await this.getStats(userId);
    
    // 1. Sync Leads from local file
    try {
        const leads = await LeadService.getLeads(userId);
        data.totals.leads = leads.length;
    } catch (e) { console.error("Leads sync error:", e); }

    // 2. Sync Messages from Firestore
    try {
      const inboxRef = adminDb.collection('users').doc(userId).collection('inbox');
      const snapshot = await inboxRef.get();
      const messages = snapshot.docs.map(doc => doc.data());
      data.totals.messages = messages.length;
      
      // Basic AI vs Human split based on existence of 'fromMe' if available
      let aiCount = 0;
      let humanCount = 0;
      messages.forEach(m => {
          if (m.fromMe === true) aiCount++; // Approximate
      });
      // We'll set AI responses to at least something reasonable if we can't tell perfectly
      data.totals.aiResponses = Math.max(data.totals.aiResponses, aiCount);
      
      console.log(`[${userId}] Sync complete: ${messages.length} messages, ${data.totals.leads} leads.`);
    } catch (err) {
      console.error(`[${userId}] Sync Error:`, err);
    }

    this.saveStats(userId, data);
  }

  private static saveStats(userId: string, data: AnalyticsData) {
    const filePath = this.getFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Error writing analytics for ${userId}:`, err);
    }
  }
}
