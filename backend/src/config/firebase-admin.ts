import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK (ESM-compatible)
if (!getApps().length) {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e) {
            console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var", e);
        }
    }

    if (!serviceAccount) {
        try {
            serviceAccount = require('./serviceAccountKey.json');
        } catch (e) {
            console.warn("serviceAccountKey.json not found, falling back to applicationDefault()");
        }
    }

    if (serviceAccount) {
        initializeApp({
            credential: cert(serviceAccount),
            databaseURL: "https://whatsapp-ai-e0b6e-default-rtdb.firebaseio.com"
        });
    } else {
        initializeApp({
            credential: applicationDefault(),
            databaseURL: "https://whatsapp-ai-e0b6e-default-rtdb.firebaseio.com"
        });
    }
}

const adminDb = getFirestore();

export { adminDb };
