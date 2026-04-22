import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product } from '../models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data/users');

export class ProductService {
  private static getFilePath(userId: string) {
    const userDir = path.join(DATA_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return path.join(userDir, 'products.json');
  }

  static async getProducts(userId: string): Promise<Product[]> {
    const filePath = this.getFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading products for ${userId}:`, err);
      return [];
    }
  }

  static async saveProduct(userId: string, product: Product): Promise<void> {
    const products = await this.getProducts(userId);
    const index = products.findIndex(p => p.id === product.id);
    
    if (index !== -1) {
      products[index] = product;
    } else {
      products.push(product);
    }
    
    this.writeProducts(userId, products);
  }

  static async deleteProduct(userId: string, productId: string): Promise<void> {
    const products = await this.getProducts(userId);
    const filtered = products.filter(p => p.id !== productId);
    this.writeProducts(userId, filtered);
  }

  private static writeProducts(userId: string, products: Product[]) {
    const filePath = this.getFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    } catch (err) {
      console.error(`Error writing products for ${userId}:`, err);
    }
  }
}
