import { WASocket } from '@whiskeysockets/baileys';
import { adminDb } from '../config/firebase-admin.js';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { Server } from 'socket.io';
import type { MessageStore } from '../whatsapp/connection.js';
import { messageStores } from '../whatsapp/connection.js';
import { ProductService } from '../services/productService.js';
import { LeadService } from '../services/leadService.js';
import { OrderService } from '../services/orderService.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { Order } from '../models/types.js';
import { SyncService } from '../services/syncService.js';
import { VoiceService } from '../services/voiceService.js';

export const generateAIResponse = async (
    userId: string, 
    remoteJid: string, 
    incomingText: string, 
    sock: WASocket, 
    store: MessageStore,
    io: Server,
    isCallMode: boolean = false
) => {
    const result = await processAIEngine(userId, remoteJid, incomingText, isCallMode);
    if (!result || !result.replyText) return;

    const { replyText, finalText, leadData } = result;

    try {
        // WhatsApp specific delivery
        const settingsDoc = await adminDb.collection('users').doc(userId).collection('settings').doc('ai').get();
        const settings = settingsDoc.data() || {};

        // 6. MEDIA PARSER: Scan for [IMAGE: url] tags
        const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\]/g;
        let match;
        
        // Strip lead and image tags from final message text
        let cleanText = replyText.replace(/\[LEAD:.*?\]/i, '').trim();
        imageRegex.lastIndex = 0;

        while ((match = imageRegex.exec(cleanText)) !== null) {
            const imageUrl = match[1];
            await sock.sendMessage(remoteJid, { image: { url: imageUrl }, caption: "Check this out!" });
        }

        let mediaData: string | undefined = undefined;

        if (finalText) {
            console.log(`[${userId}] ✅ AI response generated: "${finalText.substring(0, 50)}..."`);
            
            if (isCallMode) {
                console.log(`[${userId}] 🎤 Synthesizing voice response for WhatsApp...`);
                let audioBuffer: Buffer | null = null;
                
                try {
                    audioBuffer = await VoiceService.textToSpeech(finalText, settings.language === 'urdu' ? 'ur' : 'en', settings);
                } catch (voiceErr) {
                    console.error(`[${userId}] ⚠️ First TTS attempt failed, retrying once...`, voiceErr);
                    try {
                        audioBuffer = await VoiceService.textToSpeech(finalText, settings.language === 'urdu' ? 'ur' : 'en', settings);
                    } catch (retryErr) {
                        console.error(`[${userId}] ❌ Voice synthesis failed after retry:`, retryErr);
                    }
                }

                if (audioBuffer) {
                    await sock.sendMessage(remoteJid, { audio: audioBuffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' });
                    // Convert to base64 for Dashboard UI - EXACT MIME TYPE is critical for Chrome/Edge to parse duration
                    mediaData = `data:audio/ogg; codecs=opus;base64,${audioBuffer.toString('base64')}`;
                    console.log(`[${userId}] ✅ Voice response sent to WhatsApp.`);
                } else {
                    console.log(`[${userId}] ⚠️ Falling back to text response due to TTS failure.`);
                    await sock.sendMessage(remoteJid, { text: finalText });
                    // Update payload type to text since we fell back
                    isCallMode = false; // This is a safe local override so outPayload below knows it's text
                }
            } else {
                await sock.sendMessage(remoteJid, { text: finalText });
            }
            await AnalyticsService.trackEvent(userId, 'aiResponses');
        }

        // 7. Push to frontend
        const outPayload = {
            id: `ai_${Date.now()}`,
            type: isCallMode ? 'audio' : 'text',
            text: finalText,
            mediaData: mediaData,
            sender: remoteJid,
            timestamp: new Date().toISOString(),
            fromMe: true,
        };

        console.log(`[${userId}] 🚀 AI Outgoing (${outPayload.type.toUpperCase()}): "${finalText.substring(0, 50)}..."`);

        const isOnline = SyncService.isUserOnline(userId);
        if (isOnline) {
            io.to(`user_${userId}`).emit('new_message', outPayload);
        } else {
            await SyncService.addToBuffer(userId, 'message', outPayload);
        }

        // 8. Save to Firebase backup
        await adminDb.collection('users').doc(userId).collection('inbox').doc(outPayload.id).set({
            id: outPayload.id,
            type: outPayload.type,
            text: outPayload.text || "",
            mediaData: outPayload.mediaData || null, // Firestore doesn't like undefined
            sender: outPayload.sender,
            timestamp: outPayload.timestamp,
            fromMe: outPayload.fromMe,
            processed: true
        });

    } catch (error: any) {
        console.error(`[${userId}] ❌ AI delivery error:`, error?.message || error);
    }
};

export const processAIEngine = async (
    userId: string, 
    remoteJid: string, 
    incomingText: string, 
    isCallMode: boolean = false
) => {
    try {
        // 1. Get User AI Settings
        const settingsDoc = await adminDb.collection('users').doc(userId).collection('settings').doc('ai').get();
        if (!settingsDoc.exists) {
            console.log(`[${userId}] No AI settings found.`);
            return;
        }

        const settings = settingsDoc.data();
        if (!settings?.provider) return;

        // 2. Fetch Store Catalog for context injection
        const products = await ProductService.getProducts(userId);
        const availableProducts = products.filter(p => p.stock > 0);
        
        let isEcommerceMode = availableProducts.length > 0;
        let catalogContext = "";
        
        if (isEcommerceMode) {
            catalogContext = "\n\n--- STORE CATALOG (Latest) ---\n";
            availableProducts.forEach(p => {
                catalogContext += `- ID: ${p.id}, Category: ${p.category}, Title: ${p.title}, Price: PKR ${p.price}, Stock: ${p.stock}, Image: ${p.imageUrl || "No Image"}\n`;
            });
        }

        const smartRules = `
--- SMART AI RULES ---
${isEcommerceMode ? `
**ECOMMERCE MODE ACTIVE**
1. FLOW: Ask user need -> Suggest 2-3 products max -> Ask quantity -> Confirm Order -> Ask address.
2. STOCK: Check stock in catalog. DO NOT sell out-of-stock items. DO NOT sell more than available stock. If they ask for more than stock, explain gently.
3. IMAGES: Use [IMAGE: url] on a new line to show products.
4. ORDER CAPTURE (CRITICAL): When the user explicitly CONFIRMS the purchase, you MUST append this EXACT tag at the VERY END of your message (hidden from user):
[ORDER: productId | quantity | customerName | address]
- If name/address are unknown, put "Unknown". 
- Example: [ORDER: p_123 | 2 | Ali | Unknown]
` : `
**SERVICE MODE ACTIVE**
1. FLOW: Ask user need -> Provide info -> Book appointment/Gather Lead.
2. LEAD CAPTURE (CRITICAL): When user provides Name and Phone, append this EXACT tag at the END:
[LEAD: Name | Email (or Unknown) | Phone | {"requested_service": "...", "preferred_time": "..."}]
`}
5. LANGUAGE & BEHAVIOR: Use Natural Roman Urdu/English natively. No robotic answers. ALWAYS remain professional.
${isCallMode ? '6. VOICE MODE IS ACTIVE: Speak like a human, limit lists, keep it very short.' : ''}
`;

        // 3. Build Context from history
        const store = messageStores[userId] || {};
        const recentMessages = store[remoteJid] || [];
        let historyText = "";
        recentMessages.slice(-30).forEach(m => {
            const txt = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
            if (txt) {
                historyText += `${m.key.fromMe ? "Assistant" : "User"}: ${txt}\n`;
            }
        });

        const fullSystemPrompt = (settings.systemPrompt || 'You are a helpful WhatsApp sales assistant.') + catalogContext + smartRules;
        let replyText = "";

        console.log(`[${userId}] AI processing message: "${incomingText}"`);

        // 4. Route to AI provider
        if (settings.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey: settings.geminiKey || "" });
            const prompt = `${fullSystemPrompt}\n\nConversation History:\n${historyText}\nUser: ${incomingText}\nAssistant:`;
            const response = await ai.getGenerativeModel({ model: 'gemini-2.0-flash' }).generateContent(prompt);
            replyText = response.response.text() || "";

        } else if (settings.provider === 'openrouter' || settings.provider === 'openai') {
            const isRouter = settings.provider === 'openrouter';
            const client = new OpenAI({
                apiKey: (isRouter ? settings.openRouterKey : settings.openAiKey) || "",
                baseURL: isRouter ? "https://openrouter.ai/api/v1" : undefined,
            });
            const messages: any[] = [{ role: "system", content: fullSystemPrompt }];
            recentMessages.slice(-30).forEach(m => {
                const txt = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
                if (txt) {
                    messages.push({ role: m.key.fromMe ? "assistant" : "user", content: txt });
                }
            });
            messages.push({ role: "user", content: incomingText });

            const completion = await client.chat.completions.create({
                model: isRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini",
                messages,
                max_tokens: 1024,
            });
            replyText = completion.choices[0]?.message?.content || "";
        }

        if (!replyText.trim()) return;

        console.log(`[${userId}] AI raw reply: "${replyText}"`);

        // 5. PARSE TRIGGERS (ORDER OR LEAD)
        let cleanText = replyText;
        let leadData: any = null;

        // ORDER PARSING
        const orderRegex = /\[ORDER:\s*([^|\]]+)\|\s*([^|\]]+)\|\s*([^|\]]+)\|\s*([^|\]]+)\]/i;
        let orderMatch = replyText.match(orderRegex);

        if (orderMatch) {
            const rawProductId = orderMatch[1].trim();
            const rawQuantity = parseInt(orderMatch[2].trim(), 10);
            const customerName = orderMatch[3].trim();
            const address = orderMatch[4].trim();

            const targetProduct = products.find(p => p.id === rawProductId || p.title.toLowerCase().includes(rawProductId.toLowerCase()));

            if (targetProduct) {
                if (targetProduct.stock < rawQuantity) {
                    console.log(`[${userId}] ⚠️ Order rejected: Stock insufficient (Requested: ${rawQuantity}, Available: ${targetProduct.stock})`);
                    cleanText = `Sorry, we only have ${targetProduct.stock} pieces left of ${targetProduct.title}. How many would you like instead?`;
                } else {
                    // Create Order
                    const newOrder: Order = {
                        id: `order_${Date.now()}`,
                        productId: targetProduct.id,
                        productName: targetProduct.title,
                        quantity: rawQuantity,
                        pricePerUnit: targetProduct.price,
                        totalPrice: targetProduct.price * rawQuantity,
                        customerName: customerName !== 'Unknown' ? customerName : 'Customer',
                        customerPhone: remoteJid.replace('@s.whatsapp.net', ''),
                        address: address,
                        status: 'pending',
                        timestamp: new Date().toISOString(),
                        type: 'order'
                    };

                    targetProduct.stock -= rawQuantity;
                    await ProductService.saveProduct(userId, targetProduct); // Deduct stock
                    await OrderService.saveOrder(userId, newOrder); // Save Order

                    // Create Lead
                    await LeadService.saveLead(userId, {
                        id: `lead_${Date.now()}`,
                        name: newOrder.customerName,
                        phone: newOrder.customerPhone,
                        email: "Unknown",
                        tag: "Order",
                        createdAt: new Date().toISOString().split('T')[0],
                        details: {
                            orderId: newOrder.id,
                            product: newOrder.productName,
                            qty: newOrder.quantity,
                            total: newOrder.totalPrice
                        }
                    });

                    console.log(`[${userId}] ✅ Order & Lead Confirmed for ${newOrder.productName} (x${newOrder.quantity})`);
                    
                    // Replace AI output with standard success formatting
                    cleanText = cleanText.replace(orderMatch[0], '').trim();
                    if (!cleanText.includes("Your order has been confirmed")) {
                        cleanText = `✅ Your order has been confirmed!\nProduct: ${newOrder.productName}\nQuantity: ${newOrder.quantity}\nTotal: PKR ${newOrder.totalPrice}\n\nPlease share your address for delivery.`;
                    }
                }
            } else {
                console.log(`[${userId}] ⚠️ Order skipped: Product not found (${rawProductId})`);
                cleanText = cleanText.replace(orderMatch[0], '').trim();
            }
        } 
        
        // IF NO ORDER, TRY TO PARSE EXPLICIT LEAD TAG
        if (!orderMatch) {
            const leadRegex = /\[LEAD:\s*([^|\]]+)\|\s*([^|\]]+)\|\s*([^|\]]+)(?:\|\s*(\{.*?\}))?\]/i;
            let leadMatch = replyText.match(leadRegex);

            if (leadMatch) {
                let details = {};
                if (leadMatch[4]) {
                    try { details = JSON.parse(leadMatch[4]); } catch(e) {}
                }
                leadData = {
                    name: leadMatch[1].trim(),
                    email: leadMatch[2].trim(),
                    phone: leadMatch[3].trim(),
                    details
                };

                await LeadService.saveLead(userId, {
                    id: `lead_${Date.now()}`,
                    name: leadData.name,
                    email: leadData.email,
                    phone: leadData.phone,
                    tag: "Service Request",
                    createdAt: new Date().toISOString().split('T')[0],
                    details: leadData.details
                });
                cleanText = cleanText.replace(leadMatch[0], '').trim();
            }
        }

        // 6. Finalize Text Format
        const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\]/g;
        const finalText = cleanText.replace(imageRegex, '').trim();

        // Track analytics
        await AnalyticsService.trackEvent(userId, 'aiResponses');

        return { replyText, finalText, leadData };

    } catch (error: any) {
        console.error(`[${userId}] ❌ AI engine error:`, error?.message || error);
        return null;
    }
};
