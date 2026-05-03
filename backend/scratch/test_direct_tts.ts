import fetch from 'node-fetch';
import fs from 'fs';

async function run() {
    const text = encodeURIComponent("یہ ایک ٹیسٹ ہے");
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=ur&client=tw-ob`;
    const res = await fetch(url);
    const buffer = await res.buffer();
    fs.writeFileSync('direct.mp3', buffer);
    console.log(`Wrote ${buffer.byteLength} bytes`);
}
run();
