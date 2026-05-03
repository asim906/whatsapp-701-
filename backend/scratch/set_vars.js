import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const sa = fs.readFileSync('src/config/serviceAccountKey.json', 'utf8');
const sa_compact = JSON.stringify(JSON.parse(sa));

const projectId = "993410d4-18a3-4071-a2b1-f26a17e4f4a0";
const envId = "390a30f8-1f04-40c3-9112-4c79127df9c7";
const serviceId = "5cd1101b-8cc0-4420-8be1-a4918e5961f3";

process.env.RAILWAY_PROJECT_ID = projectId;
process.env.RAILWAY_ENVIRONMENT_ID = envId;

try {
    console.log("Setting FIREBASE_SERVICE_ACCOUNT...");
    // Use a temporary file to set variables if supported, or use a very careful shell escape
    // Actually, railway variables set can take multiple args.
    // We'll use a double-quoted string and escape internal double quotes.
    const escapedSa = sa_compact.replace(/"/g, '\\"');
    execSync(`railway variables set "FIREBASE_SERVICE_ACCOUNT=${escapedSa}" --service ${serviceId}`, { stdio: 'inherit' });
    console.log("Successfully set FIREBASE_SERVICE_ACCOUNT");
} catch (error) {
    console.error("Failed to set variables:", error.message);
}
