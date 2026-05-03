import { UniversalEdgeTTS } from 'edge-tts-universal';
import fs from 'fs';

async function test() {
  console.log("Testing Uzma Neural...");
  const tts = new UniversalEdgeTTS("ٹیسٹ", "ur-PK-UzmaNeural");
  const audioData: any = await tts.synthesize();
  
  let buffer;
  if (audioData.audio && typeof audioData.audio.arrayBuffer === 'function') {
    buffer = Buffer.from(await audioData.audio.arrayBuffer());
  } else if (Buffer.isBuffer(audioData)) {
    buffer = audioData;
  } else if (audioData instanceof Uint8Array) {
    buffer = Buffer.from(audioData);
  } else if (audioData.data) {
    buffer = Buffer.from(audioData.data);
  }

  console.log("Uzma Buffer:", buffer ? buffer.byteLength : "null");
  if (buffer) fs.writeFileSync('uzma.mp3', buffer);

  console.log("Testing Aria Neural...");
  const tts2 = new UniversalEdgeTTS("Test", "en-US-AriaNeural");
  const audioData2: any = await tts2.synthesize();
  
  let buffer2;
  if (audioData2.audio && typeof audioData2.audio.arrayBuffer === 'function') {
    buffer2 = Buffer.from(await audioData2.audio.arrayBuffer());
  } else if (Buffer.isBuffer(audioData2)) {
    buffer2 = audioData2;
  } else if (audioData2 instanceof Uint8Array) {
    buffer2 = Buffer.from(audioData2);
  } else if (audioData2.data) {
    buffer2 = Buffer.from(audioData2.data);
  }

  console.log("Aria Buffer:", buffer2 ? buffer2.byteLength : "null");
  if (buffer2) fs.writeFileSync('aria.mp3', buffer2);
}

test();
