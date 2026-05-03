const text = "وعلیکم السلام! میں بالکل ٹھیک ہوں، شکریہ! ہمارے پاس شوز اور ٹی شرٹس دونوں کی اچھی ورائٹی موجود ہے۔ کیا آپ خاص طور پر شوز یا ٹی شرٹس میں دلچسپی رکھتے ہیں؟ اور کیا آپ کا کوئی خاص سائز ہے؟";
const cleanText = text
  .replace(/[*_#~`]/g, '')
  .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
  .trim() || "Empty message";

console.log("Original length:", text.length);
console.log("Cleaned length:", cleanText.length);
console.log("Cleaned text:", cleanText);
