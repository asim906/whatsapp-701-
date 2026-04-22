import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Lead } from '../models/types.js';
import { AnalyticsService } from './analyticsService.js';
import { SyncService } from './syncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/users');

export class LeadService {
  private static getFilePath(userId: string) {
    const userDir = path.join(DATA_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, 'leads.json');
  }

  static async getLeads(userId: string): Promise<Lead[]> {
    const filePath = this.getFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading leads for ${userId}:`, err);
      return [];
    }
  }

  static async saveLead(userId: string, lead: Lead): Promise<void> {
    const leads = await this.getLeads(userId);
    const index = leads.findIndex(l => l.id === lead.id);
    
    if (index !== -1) {
      leads[index] = lead;
    } else {
      leads.push(lead);
      // Track analytics for new lead
      await AnalyticsService.trackEvent(userId, 'leads');
      
      // Safety Sync Buffer: If the user is offline, store for catch-up
      if (!SyncService.isUserOnline(userId)) {
          await SyncService.addToBuffer(userId, 'lead', lead);
      }
    }
    
    this.writeLeads(userId, leads);
  }

  static async deleteLead(userId: string, leadId: string): Promise<void> {
    const leads = await this.getLeads(userId);
    const filtered = leads.filter(l => l.id !== leadId);
    this.writeLeads(userId, filtered);
  }

  private static writeLeads(userId: string, leads: Lead[]) {
    const filePath = this.getFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(leads, null, 2));
    } catch (err) {
      console.error(`Error writing leads for ${userId}:`, err);
    }
  }
}
