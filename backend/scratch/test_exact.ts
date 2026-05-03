import { UniversalEdgeTTS } from 'edge-tts-universal';
import fs from 'fs';

async function test() {
  const text = "وعلیکم السلام! میں بالکل ٹھیک ہوں، شکریہ! ہمارے پاس شوز اور ٹی شرٹس دونوں کی اچھی ورائٹی موجود ہے۔ کیا آپ خاص طور پر شوز یا ٹی شرٹس میں دلچسپی رکھتے ہیں؟ اور کیا آپ کا کوئی خاص سائز ہے؟";
  console.log("Testing text length:", text.length);
  
  const tts = new UniversalEdgeTTS(text, "ur-PK-UzmaNeural");
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

  console.log("Buffer size:", buffer ? buffer.byteLength : "null");
  if (buffer) fs.writeFileSync('test_exact.mp3', buffer);
}

test();
