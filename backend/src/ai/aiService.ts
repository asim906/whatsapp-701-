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
import fs from 'fs';
import path from 'path';

// --- HARDCODED TRANSLITERATION MAP (Instant & Zero-Latency) ---
const GREETING_MAP: Record<string, string> = {
    "السلام علیکم": "Assalam o Alaikum",
    "وعلیکم السلام": "Walaikum Assalam",
    "کیا حال ہے": "Kya haal hai",
    "میں ٹھیک ہوں": "Main theek hoon",
    "شکریہ": "Shukriya",
    "اللہ حافظ": "Allah Hafiz",
    "خدا حافظ": "Khuda Hafiz",
    "جی": "Ji",
    "ہاں": "Haan",
    "نہیں": "Nahi",
    "کیسے ہیں": "Kaise hain",
    "کیسی ہیں": "Kaisi hain",
    "آپ": "Aap",
    "تم": "Tum"
};

function fastTransliterate(text: string): string {
    let result = text;
    // Simple greedy replacement for common phrases
    Object.entries(GREETING_MAP).forEach(([urdu, roman]) => {
        const regex = new RegExp(urdu, 'g');
        result = result.replace(regex, roman);
    });
    return result;
}

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

    let { replyText, finalText, leadData } = result;

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
            
            let responseText = finalText;

            // --- IRON-CLAD ROMAN URDU ENFORCEMENT FOR VOICE ---
            const scriptRegex = /[\u0600-\u06FF\u0900-\u097F]/;
            const hasScript = scriptRegex.test(finalText);

            // LOG TO FILE FOR DEBUGGING
            const logMsg = `[${new Date().toISOString()}] ${userId} | isCallMode: ${isCallMode} | hasScript: ${hasScript} | Text: ${finalText.substring(0, 50)}\n`;
            fs.appendFileSync(path.join(process.cwd(), 'debug_lang.log'), logMsg);

            console.log(`[${userId}] 🎙️ MODE: Voice=${isCallMode}, HasScript=${hasScript}`);

            if (isCallMode && hasScript) {
                console.log(`[${userId}] 🔄 FORCING ROMANIZATION...`);
                
                // Step 1: Fast Hardcoded Map (Instant)
                responseText = fastTransliterate(finalText);
                
                // Step 2: AI Transliteration (if still has script)
                if (scriptRegex.test(responseText)) {
                    try {
                        const apiKey = settings.openAiKey || settings.openRouterKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
                        if (apiKey) {
                            const systemRole = "You are a professional transliterator. Convert Urdu/Hindi script to Roman Urdu/English (Latin alphabet ONLY). NEVER return the original script.";
                            const translitPrompt = `Convert this text to Roman Urdu (Latin script only): "${finalText}"`;
                            
                            let transliterated = "";
                            if (apiKey.startsWith('gsk_')) {
                                const { default: Groq } = await import('groq-sdk');
                                const groq = new Groq({ apiKey });
                                const response = await groq.chat.completions.create({
                                    messages: [{ role: 'system', content: systemRole }, { role: 'user', content: translitPrompt }],
                                    model: 'llama3-8b-8192'
                                });
                                transliterated = response.choices[0]?.message?.content?.trim() || "";
                            } else {
                                const { default: OpenAI } = await import('openai');
                                const openai = new OpenAI({ apiKey });
                                const response = await openai.chat.completions.create({
                                    messages: [{ role: 'system', content: systemRole }, { role: 'user', content: translitPrompt }],
                                    model: 'gpt-4o-mini'
                                });
                                transliterated = response.choices[0]?.message?.content?.trim() || "";
                            }

                            if (transliterated && !scriptRegex.test(transliterated)) {
                                responseText = transliterated;
                                console.log(`[${userId}] ✅ AI Transliteration Successful.`);
                            }
                        }
                    } catch (err: any) {
                        console.error(`[${userId}] ❌ AI Transliteration failed:`, err.message);
                    }
                }

                // Step 3: Final Sanitization (No matter what, NO script in voice)
                if (scriptRegex.test(responseText)) {
                    console.warn(`[${userId}] 🚨 Script LEAK detected! Forcing emergency English fallback.`);
                    responseText = "I'm sorry, I'm having trouble generating the voice response in Urdu script. How can I help you?";
                }
            }

            // Now delivery
            if (isCallMode) {
                console.log(`[${userId}] 🎤 VOICE Delivery: "${responseText.substring(0, 40)}..."`);
                let audioBuffer: Buffer | null = null;
                try {
                    audioBuffer = await VoiceService.textToSpeech(responseText, 'en', settings);
                } catch (voiceErr: any) {
                    console.error(`[${userId}] ❌ TTS failed:`, voiceErr.message);
                }

                if (audioBuffer && audioBuffer.byteLength > 2000) {
                    await sock.sendMessage(remoteJid, { audio: audioBuffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' });
                    mediaData = `data:audio/ogg; codecs=opus;base64,${audioBuffer.toString('base64')}`;
                } else {
                    console.log(`[${userId}] ⚠️ Voice delivery failed or too short. Falling back to text.`);
                    await sock.sendMessage(remoteJid, { text: responseText });
                    isCallMode = false;
                }
            } else {
                console.log(`[${userId}] ✉️ TEXT Delivery.`);
                await sock.sendMessage(remoteJid, { text: responseText });
            }
            
            // Update finalText for analytics and UI
            finalText = responseText; 
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

const GLOBAL_PLATFORM_RULES = `
==================================================
GLOBAL VOICE/TEXT LANGUAGE RULES (STRICT)
==================================================
1. VOICE INPUT (isCallMode: true):
   - Urdu Voice -> Reply in Roman Urdu / Roman English (Latin script only).
   - Hindi Voice -> Reply in Roman Hindi / Roman English (Latin script only).
   - English Voice -> Reply in English.
   **STRICT OVERRIDE:** NEVER use Urdu/Hindi script for voice responses, even if asked.

2. TEXT INPUT (isCallMode: false):
   - Urdu Text -> Reply in Urdu Script.
   - Hindi Text -> Reply in Hindi Script.
   - English Text -> Reply in English.
==================================================
`;

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
6. PROFESSIONALISM: Always remain professional and helpful.
${isCallMode ? '7. VOICE MODE IS ACTIVE: SPEAK IN ROMAN URDU ONLY. Keep it very short and conversational.' : ''}
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

        const fullSystemPrompt = GLOBAL_PLATFORM_RULES + (settings.systemPrompt || 'You are a helpful WhatsApp sales assistant.') + catalogContext + smartRules;
        let replyText = "";

        console.log(`[${userId}] AI processing message: "${incomingText}"`);

        // 4. Route to AI provider
        if (settings.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey: settings.geminiKey || "" });
            let finalUserMessage = incomingText;
            if (isCallMode) {
                finalUserMessage += "\n\n(REMINDER: Respond in ROMAN URDU/ENGLISH only. NO Urdu script.)";
            }
            const prompt = `${fullSystemPrompt}\n\nConversation History:\n${historyText}\nUser: ${finalUserMessage}\nAssistant:`;
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
            
            // Add a final instruction to the user message to force language rule compliance
            let finalUserMessage = incomingText;
            if (isCallMode) {
                finalUserMessage += "\n\n(REMINDER: Respond in ROMAN URDU/ENGLISH only. NO Urdu script.)";
            }
            messages.push({ role: "user", content: finalUserMessage });

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
