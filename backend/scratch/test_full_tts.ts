import { VoiceService } from '../src/services/voiceService.js';
import fs from 'fs';

async function test() {
  const text = "یہ ایک ٹیسٹ ہے اور ہم چیک کر رہے ہیں کہ واٹس ایپ کے لئے آڈیو صحیح سے بنتی ہے یا نہیں";
  console.log("Testing text:", text);
  
  try {
    const buffer = await VoiceService.textToSpeech(text, 'ur');
    console.log("Returned buffer length:", buffer.length);
    fs.writeFileSync('test_final.ogg', buffer);
    console.log("Wrote test_final.ogg");
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
