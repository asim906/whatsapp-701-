import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Order } from '../models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/users');

export class OrderService {
  private static getFilePath(userId: string) {
    const userDir = path.join(DATA_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, 'orders.json');
  }

  static async getOrders(userId: string): Promise<Order[]> {
    const filePath = this.getFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading orders for ${userId}:`, err);
      return [];
    }
  }

  static async saveOrder(userId: string, order: Order): Promise<void> {
    const orders = await this.getOrders(userId);
    const index = orders.findIndex(o => o.id === order.id);
    
    if (index !== -1) {
      orders[index] = order;
    } else {
      orders.push(order);
    }
    
    this.writeOrders(userId, orders);
  }

  static async deleteOrder(userId: string, orderId: string): Promise<void> {
    const orders = await this.getOrders(userId);
    const filtered = orders.filter(o => o.id !== orderId);
    this.writeOrders(userId, filtered);
  }

  private static writeOrders(userId: string, orders: Order[]) {
    const filePath = this.getFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
    } catch (err) {
      console.error(`Error writing orders for ${userId}:`, err);
    }
  }
}
