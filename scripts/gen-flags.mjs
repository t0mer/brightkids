// Generates the "מִי הַמְּדִינָה?" flag-guessing game as a multiple-choice lesson
// in every subject and stage. The child sees a flag and picks the country
// (Hebrew) from 4 options. Pool of 80+ countries; the app samples 10 per play
// and lets the child shuffle for more (competition style).
//
//   node scripts/gen-flags.mjs
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// [flag emoji, Hebrew country name]. Proper nouns are left unvocalized.
const COUNTRIES = [
  ["🇮🇱", "ישראל"], ["🇺🇸", "ארצות הברית"], ["🇬🇧", "בריטניה"], ["🇫🇷", "צרפת"],
  ["🇩🇪", "גרמניה"], ["🇮🇹", "איטליה"], ["🇪🇸", "ספרד"], ["🇵🇹", "פורטוגל"],
  ["🇳🇱", "הולנד"], ["🇧🇪", "בלגיה"], ["🇨🇭", "שווייץ"], ["🇦🇹", "אוסטריה"],
  ["🇸🇪", "שוודיה"], ["🇳🇴", "נורווגיה"], ["🇩🇰", "דנמרק"], ["🇫🇮", "פינלנד"],
  ["🇮🇪", "אירלנד"], ["🇮🇸", "איסלנד"], ["🇵🇱", "פולין"], ["🇨🇿", "צ׳כיה"],
  ["🇭🇺", "הונגריה"], ["🇬🇷", "יוון"], ["🇷🇺", "רוסיה"], ["🇺🇦", "אוקראינה"],
  ["🇷🇴", "רומניה"], ["🇹🇷", "טורקיה"], ["🇪🇬", "מצרים"], ["🇯🇴", "ירדן"],
  ["🇱🇧", "לבנון"], ["🇸🇦", "ערב הסעודית"], ["🇦🇪", "איחוד האמירויות"], ["🇮🇶", "עיראק"],
  ["🇮🇷", "איראן"], ["🇸🇾", "סוריה"], ["🇲🇦", "מרוקו"], ["🇹🇳", "תוניסיה"],
  ["🇩🇿", "אלג׳יריה"], ["🇱🇾", "לוב"], ["🇿🇦", "דרום אפריקה"], ["🇳🇬", "ניגריה"],
  ["🇰🇪", "קניה"], ["🇪🇹", "אתיופיה"], ["🇬🇭", "גאנה"], ["🇨🇳", "סין"],
  ["🇯🇵", "יפן"], ["🇰🇷", "דרום קוריאה"], ["🇮🇳", "הודו"], ["🇹🇭", "תאילנד"],
  ["🇻🇳", "וייטנאם"], ["🇵🇭", "הפיליפינים"], ["🇮🇩", "אינדונזיה"], ["🇲🇾", "מלזיה"],
  ["🇸🇬", "סינגפור"], ["🇵🇰", "פקיסטן"], ["🇧🇩", "בנגלדש"], ["🇦🇺", "אוסטרליה"],
  ["🇳🇿", "ניו זילנד"], ["🇨🇦", "קנדה"], ["🇲🇽", "מקסיקו"], ["🇧🇷", "ברזיל"],
  ["🇦🇷", "ארגנטינה"], ["🇨🇱", "צ׳ילה"], ["🇨🇴", "קולומביה"], ["🇵🇪", "פרו"],
  ["🇻🇪", "ונצואלה"], ["🇺🇾", "אורוגוואי"], ["🇧🇴", "בוליביה"], ["🇪🇨", "אקוודור"],
  ["🇨🇺", "קובה"], ["🇯🇲", "ג׳מייקה"], ["🇵🇦", "פנמה"], ["🇨🇷", "קוסטה ריקה"],
  ["🇬🇹", "גואטמלה"], ["🇸🇰", "סלובקיה"], ["🇭🇷", "קרואטיה"], ["🇷🇸", "סרביה"],
  ["🇧🇬", "בולגריה"], ["🇸🇮", "סלובניה"], ["🇱🇹", "ליטא"], ["🇱🇻", "לטביה"],
  ["🇪🇪", "אסטוניה"], ["🇨🇾", "קפריסין"], ["🇲🇹", "מלטה"], ["🇱🇺", "לוקסמבורג"],
  ["🇶🇦", "קטאר"], ["🇰🇼", "כווית"], ["🇴🇲", "עומאן"], ["🇧🇭", "בחריין"],
  ["🇹🇼", "טייוואן"], ["🇺🇿", "אוזבקיסטן"],
];

// Seeded RNG (mulberry32) for reproducible distractor/order choices.
let _s = 20260701;
function rand() {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a) {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

// The two regional-indicator letters of a flag emoji spell its ISO 3166 code,
// which is also the filename of the bundled SVG (web/public/flags/<cc>.svg).
// Real SVGs render everywhere; the flag emoji falls back to letters on Windows.
const isoCode = (flag) =>
  [...flag].map((ch) => String.fromCodePoint(ch.codePointAt(0) - 0x1f1e6 + 97)).join("");

// Build the question pool: flag image + correct + 3 country distractors. The
// frontend re-shuffles option order and samples which flags appear each play.
function questionLines() {
  const lines = [];
  COUNTRIES.forEach(([flag, name], idx) => {
    const distractors = shuffle(COUNTRIES.filter((_, i) => i !== idx)).slice(0, 3).map((c) => c[1]);
    lines.push(`  - image: "/flags/${isoCode(flag)}.svg"`);
    lines.push(`    items:`);
    [name, ...distractors].forEach((label, i) => {
      lines.push(`      - { id: o${i + 1}, label: "${label}"${i === 0 ? ", correct: true" : ""} }`);
    });
  });
  return lines;
}

// A single top-level game (hidden from the stage lists; launched from its own
// tile on the subjects screen). Content is Hebrew, so it lives under content/hebrew.
const out = [
  `id: flags`, `subject: hebrew`, `grade: 1`, `difficulty: 2`,
  `locale: he-IL`, `direction: rtl`, `title: "מִי הַמְּדִינָה?"`, `activity: multiple-choice`,
  `prompt_tts: "בַּחֲרוּ אֶת הַמְּדִינָה שֶׁל הַדֶּגֶל"`, `sample: 10`, `hidden: true`, `questions:`,
  ...questionLines(),
  `reward: { stars: 3, sfx: ding, effect: confetti }`,
];
writeFileSync(resolve(ROOT, "content/hebrew/flags.yaml"), out.join("\n") + "\n");
console.log(`generated flags.yaml (${COUNTRIES.length} countries)`);
