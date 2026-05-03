import { UniversalEdgeTTS } from 'edge-tts-universal';
import fs from 'fs';

async function test() {
  const text = "یہ ایک ٹیسٹ ہے";
  console.log("Synthesizing:", text);
  
  const tts = new UniversalEdgeTTS(text, 'ur-PK-UzmaNeural');
  try {
    const audioData = await tts.synthesize();
    let buffer;
    if (audioData.audio && typeof audioData.audio.arrayBuffer === 'function') {
      const arrayBuffer = await audioData.audio.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (Buffer.isBuffer(audioData)) {
      buffer = audioData;
    } else if (audioData instanceof Uint8Array) {
      buffer = Buffer.from(audioData);
    } else if (audioData.data && (audioData.data instanceof Uint8Array || Array.isArray(audioData.data))) {
      buffer = Buffer.from(audioData.data);
    } else {
      console.log("Unknown format");
      return;
    }
    console.log("Buffer length:", buffer.length);
    fs.writeFileSync('test.mp3', buffer);
    console.log("Wrote test.mp3");
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
