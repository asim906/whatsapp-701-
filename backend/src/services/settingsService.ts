import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/users');

export interface ColumnConfig {
  id: string;
  label: string;
  isVisible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', isVisible: true },
  { id: 'phone', label: 'Phone', isVisible: true },
  { id: 'email', label: 'Email', isVisible: true },
  { id: 'tag', label: 'Tag', isVisible: true },
  { id: 'createdAt', label: 'Date', isVisible: true },
];

export class SettingsService {
  private static getFilePath(userId: string) {
    const userDir = path.join(DATA_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, 'leads_config.json');
  }

  static async getLeadsConfig(userId: string): Promise<ColumnConfig[]> {
    const filePath = this.getFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return DEFAULT_COLUMNS;
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading leads config for ${userId}:`, err);
      return DEFAULT_COLUMNS;
    }
  }

  static async saveLeadsConfig(userId: string, config: ColumnConfig[]): Promise<void> {
    const filePath = this.getFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error(`Error writing leads config for ${userId}:`, err);
    }
  }
}
