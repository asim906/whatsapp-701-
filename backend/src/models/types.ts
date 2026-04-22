export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  tag: string;
  createdAt: string;
  details?: Record<string, any>;
}

export interface AISettings {
  provider: 'gemini' | 'openai' | 'openrouter';
  systemPrompt?: string;
  geminiKey?: string;
  openAiKey?: string;
  openRouterKey?: string;
}

export interface Order {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  customerName: string;
  customerPhone: string;
  address: string;
  status: 'pending' | 'confirmed' | 'delivered';
  timestamp: string;
  type: 'order';
}
