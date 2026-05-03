import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initializeWhatsApp, activeSockets, chatStores } from './whatsapp/connection.js';
import { ProductService } from './services/productService.js';
import { LeadService } from './services/leadService.js';
import { OrderService } from './services/orderService.js';
import { SettingsService } from './services/settingsService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { CallController } from './whatsapp/callController.js';
import { SyncService } from './services/syncService.js';
import { VoiceSessionManager } from './services/VoiceSessionManager.js';

// Explicitly track active users for reliable message delivery
export const activeUsers = new Map<string, string>(); // userId -> socketId

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { StripeService } from './services/stripeService.js';
import { adminDb } from './config/firebase-admin.js';
import Stripe from 'stripe';

const app = express();
app.use(cors());

// --- Stripe Webhook API (Needs raw body for signature verification) ---
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2023-10-16' });
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // If deployed without a webhook secret (test mode only)
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.client_reference_id;
        const planId = session.subscription_data?.metadata?.planId || 'starter';
        
        if (userId) {
          await adminDb.collection('users').doc(userId).update({
            plan: planId,
            subscriptionStatus: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          });
          console.log(`[Stripe] ✅ Activated plan ${planId} for user ${userId}`);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        // In real terms, look up user by stripeCustomerId
        const qs = await adminDb.collection('users').where('stripeCustomerId', '==', invoice.customer).get();
        if (!qs.empty) {
          await qs.docs[0].ref.update({ subscriptionStatus: 'active' });
          console.log(`[Stripe] ✅ Renewal successful for ${invoice.customer}.`);
        }
        break;
      }
      case 'invoice.payment_failed':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const subEvent = event.data.object as any;
        const customerId = subEvent.customer;
        const qs = await adminDb.collection('users').where('stripeCustomerId', '==', customerId).get();
        if (!qs.empty) {
          await qs.docs[0].ref.update({ subscriptionStatus: 'inactive' });
          console.log(`[Stripe] ❌ Access locked for customer ${customerId}.`);
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }

  res.send();
});

app.use(express.json());

const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize services after Socket.io is ready
SyncService.init(io);
VoiceSessionManager.init(io);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running 24/7' });
});

// --- Analytics API ---
app.get('/api/analytics/:userId', async (req, res) => {
  const stats = await AnalyticsService.getStats(req.params.userId);
  res.json(stats);
});

// --- Sync API ---
app.get('/api/sync/catchup/:userId', async (req, res) => {
  const pending = await SyncService.getPending(req.params.userId);
  res.json(pending);
});

app.post('/api/sync/acknowledge/:userId', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Array of ids is required' });
  }
  await SyncService.acknowledge(req.params.userId, ids);
  res.json({ success: true });
});

// --- Settings API ---
app.get('/api/leads/settings/:userId', async (req, res) => {
  const config = await SettingsService.getLeadsConfig(req.params.userId);
  res.json(config);
});

app.post('/api/leads/settings/:userId', async (req, res) => {
  await SettingsService.saveLeadsConfig(req.params.userId, req.body);
  res.json({ success: true });
});

// --- Store API ---
app.get('/api/store/:userId', async (req, res) => {
  const products = await ProductService.getProducts(req.params.userId);
  res.json(products);
});

app.post('/api/store/:userId', async (req, res) => {
  await ProductService.saveProduct(req.params.userId, req.body);
  res.json({ success: true });
});

app.delete('/api/store/:userId/:productId', async (req, res) => {
  await ProductService.deleteProduct(req.params.userId, req.params.productId);
  res.json({ success: true });
});

// --- Leads API ---
app.get('/api/leads/:userId', async (req, res) => {
  const leads = await LeadService.getLeads(req.params.userId);
  res.json(leads);
});

app.post('/api/leads/:userId', async (req, res) => {
  await LeadService.saveLead(req.params.userId, req.body);
  res.json({ success: true });
});

app.delete('/api/leads/:userId/:leadId', async (req, res) => {
  await LeadService.deleteLead(req.params.userId, req.params.leadId);
  res.json({ success: true });
});

// --- Orders API ---
app.get('/api/orders/:userId', async (req, res) => {
  const orders = await OrderService.getOrders(req.params.userId);
  res.json(orders);
});

app.post('/api/orders/:userId', async (req, res) => {
  await OrderService.saveOrder(req.params.userId, req.body);
  res.json({ success: true });
});

app.delete('/api/orders/:userId/:orderId', async (req, res) => {
  await OrderService.deleteOrder(req.params.userId, req.params.orderId);
  res.json({ success: true });
});

// --- Stripe API (Checkout) ---
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  const { userId, email, planId } = req.body;
  
  if (!userId || !email || !planId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const session = await StripeService.createCheckoutSession(userId, email, planId);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stripe/verify-session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }
  
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2023-10-16' });
    const session = await stripe.checkout.sessions.retrieve(session_id as string);
    
    if (session.payment_status === 'paid') {
      const userId = session.client_reference_id;
      const planId = session.subscription_data?.metadata?.planId || 'starter';
      
      if (userId) {
        // Update user in Firestore directly as a fallback for missing webhooks
        await adminDb.collection('users').doc(userId).update({
          plan: planId,
          subscriptionStatus: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        });
        console.log(`[Stripe Fallback] ✅ Verified and activated plan ${planId} for user ${userId}`);
        return res.json({ success: true, plan: planId });
      }
    }
    
    res.json({ success: false, status: session.payment_status });
  } catch (error: any) {
    console.error('Stripe Verify Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- WhatsApp API ---
// Start WhatsApp session for a specific user
app.post('/api/whatsapp/start', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Tell the backend to init/resume Baileys connection for this user
  initializeWhatsApp(userId, io);
  res.json({ success: true, message: `WhatsApp initialization started for user ${userId}` });
});

// Send a message from dashboard (manual mode)
app.post('/api/whatsapp/send', async (req: any, res: any) => {
  const { userId, jid, text } = req.body;
  if (!userId || !jid || !text) {
    return res.status(400).json({ error: 'userId, jid, and text are required' });
  }
  const sock = activeSockets[userId];
  if (!sock) {
    return res.status(404).json({ error: 'No active WhatsApp session for this user' });
  }
  try {
    await sock.sendMessage(jid, { text });
    // Track analytics
    await AnalyticsService.trackEvent(userId, 'humanResponses');
    await AnalyticsService.trackEvent(userId, 'messages');
    
    // Also emit to chat UI immediately
    io.to(`user_${userId}`).emit('new_message', {
      id: `manual_${Date.now()}`,
      type: 'text',
      sender: jid,
      text,
      fromMe: true,
      timestamp: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/chats/:userId', (req, res) => {
  const { userId } = req.params;
  const userChats = chatStores[userId] || {};
  res.json(Object.values(userChats));
});

// AI Call Implementation
app.post('/api/whatsapp/call', async (req, res) => {
  const { userId, jid } = req.body;
  const sock = activeSockets[userId];
  if (!sock) return res.status(400).json({ error: "WhatsApp not connected" });

  try {
    await CallController.startCall(userId, jid, sock, io);
    res.json({ success: true, message: "AI Call Started" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/call/status', (req, res) => {
  const { userId, jid } = req.query;
  const active = CallController.isCallActive(userId as string, jid as string);
  res.json({ active });
});

app.post('/api/whatsapp/call/end', (req, res) => {
  const { userId, jid } = req.body;
  CallController.endCall(userId, jid);
  res.json({ success: true });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
    // High-accuracy registration
    socket.on('register_user', async (userId) => {
      activeUsers.set(userId, socket.id);
      socket.join(`user_${userId}`);
      console.log(`[Socket] 👤 User ${userId} registered with socket ${socket.id}`);
      
      // Check if WhatsApp is truly connected in Firestore
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists && userDoc.data()?.whatsappConnected === true) {
        socket.emit('whatsapp_ready', { userId });
      }
    });

  // Legacy room joining (fallback)
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined room user_${userId}`);
  });

  socket.on('disconnect', () => {
    // Cleanup activeUsers map
    for (const [uid, sid] of activeUsers.entries()) {
      if (sid === socket.id) {
        activeUsers.delete(uid);
        console.log(`[Socket] 🔌 User ${uid} disconnected (socket ${socket.id})`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
console.log(`[Config] Starting server. PORT env: ${process.env.PORT || 'undefined (defaulting to 3001)'}`);
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 WA AI Backend is running on 0.0.0.0:${PORT}`);

  /*
  // Auto-restore all saved WhatsApp sessions on startup
  const sessionsDir = path.join(__dirname, '../sessions');
  if (fs.existsSync(sessionsDir)) {
    const sessionFolders = fs.readdirSync(sessionsDir).filter(name => name.startsWith('session_'));
    if (sessionFolders.length > 0) {
      console.log(`🔄 Auto-restoring ${sessionFolders.length} WhatsApp session(s)...`);
      sessionFolders.forEach(folder => {
        const userId = folder.replace('session_', '');
        console.log(`  → Restoring session for user: ${userId}`);
        initializeWhatsApp(userId, io);
      });
    }
  }
  */
  console.log("System ready - Waiting for user connections.");
});
