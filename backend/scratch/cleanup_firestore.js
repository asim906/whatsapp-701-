import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, '../src/config/serviceAccountKey.json'), 'utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.size === 0) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    console.log(`  → Deleted ${deleted} docs so far from "${collectionPath}"...`);

    if (snapshot.size < batchSize) break;
  }

  return deleted;
}

async function main() {
  // Collections confirmed NOT referenced anywhere in codebase:
  const toDelete = [
    'ai_settings',       // Not in any code — old collection, replaced by users/{uid}/settings/ai sub-collection
    'debug_logs',        // Not referenced anywhere in frontend or backend
    'chats',             // Not used — chats are stored in Baileys in-memory chatStores + IndexedDB
    'messages',          // Not used — messages stored in users/{uid}/inbox sub-collection + IndexedDB
    'leads_config',      // Not used — leads_config.json is stored on Railway filesystem, not Firestore
    'whatsapp_sessions', // Not used — sessions stored as local files in /sessions directory
  ];

  console.log('🔍 Starting Firestore cleanup audit...\n');

  for (const col of toDelete) {
    console.log(`\nDeleting: "${col}"`);
    const count = await deleteCollection(col);
    if (count === 0) {
      console.log(`  ℹ️  "${col}" was already empty.`);
    } else {
      console.log(`  ✅ Deleted ${count} total documents from "${col}".`);
    }
  }

  console.log('\n🎉 Firestore cleanup complete! Only "users" collection remains.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
