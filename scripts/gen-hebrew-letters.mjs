// Generates the full-alphabet Hebrew letter lessons (כיתה א) — ONE lesson per
// category, each holding the whole 22-letter pool (א-ת). The app shows a random
// sample each play and lets the child shuffle for more:
//   - he-g1-letters     : letter recognition ("מצאו את האות …")
//   - he-g1-lettername  : letter → name matching ("מתאימים אות לשם")
// Run: node scripts/gen-hebrew-letters.mjs
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../content/hebrew");

// letter, name (with nikud)
const LETTERS = [
  ["א", "אָלֶף"], ["ב", "בֵּית"], ["ג", "גִּימֶל"], ["ד", "דָּלֶת"], ["ה", "הֵא"], ["ו", "וָו"],
  ["ז", "זַיִן"], ["ח", "חֵית"], ["ט", "טֵית"], ["י", "יוֹד"], ["כ", "כַּף"], ["ל", "לָמֶד"],
  ["מ", "מֵם"], ["נ", "נוּן"], ["ס", "סָמֶךְ"], ["ע", "עַיִן"], ["פ", "פֵּא"], ["צ", "צַדִּי"],
  ["ק", "קוֹף"], ["ר", "רֵישׁ"], ["ש", "שִׁין"], ["ת", "תָּו"],
];

// Seeded RNG for stable distractor picks.
let _s = 271828;
function rand() { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(a) { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
const pad = (n) => String(n).padStart(2, "0");

// Remove the old narrow lessons and any earlier per-set files these replace.
const olds = ["he-g1-letters-01", "he-g1-match-01"];
for (let i = 1; i <= 9; i++) olds.push(`he-g1-letters-set-${pad(i)}`, `he-g1-lettername-set-${pad(i)}`);
for (const old of olds) { const p = resolve(DIR, `${old}.yaml`); if (existsSync(p)) rmSync(p); }

let files = 0;

// ---- ONE letter-recognition lesson: full alphabet pool (sampled at play) ----
{
  const lines = [
    `id: he-g1-letters`, `subject: hebrew`, `grade: 1`, `difficulty: 1`,
    `locale: he-IL`, `direction: rtl`, `title: "מְזַהִים אוֹתִיּוֹת"`,
    `activity: letter-recognition`, `prompt_tts: "מִצְאוּ אֶת הָאוֹת"`, `questions:`,
  ];
  LETTERS.forEach(([glyph, name], idx) => {
    const others = shuffle(LETTERS.filter((_, j) => j !== idx)).slice(0, 2).map((l) => l[0]);
    lines.push(`  - prompt: "מִצְאוּ אֶת הָאוֹת ${name}"`, `    items:`);
    [{ v: glyph, c: true }, ...others.map((v) => ({ v }))].forEach((o, k) =>
      lines.push(`      - { id: o${k + 1}, label: "${o.v}"${o.c ? ", correct: true" : ""} }`));
  });
  lines.push(`reward: { stars: 3, sfx: ding, effect: confetti }`, ``);
  writeFileSync(resolve(DIR, `he-g1-letters.yaml`), lines.join("\n")); files++;
}

// ---- ONE letter → name matching lesson: full alphabet pool (sampled at play) ----
{
  const lines = [
    `id: he-g1-lettername`, `subject: hebrew`, `grade: 1`, `difficulty: 1`,
    `locale: he-IL`, `direction: rtl`, `title: "מַתְאִימִים אוֹת לְשֵׁם"`,
    `activity: matching`, `prompt_tts: "הַתְאִימוּ כָּל אוֹת לַשֵּׁם שֶׁלָּהּ"`, `pairs:`,
  ];
  LETTERS.forEach(([glyph, name], k) => {
    lines.push(
      `  - id: p${k + 1}`, `    left: "${glyph}"`, `    right: "${name}"`,
      `    left_tts: "${name}"`, `    right_tts: "${name}"`,
    );
  });
  lines.push(`reward: { stars: 3, sfx: chime, effect: stars }`, ``);
  writeFileSync(resolve(DIR, `he-g1-lettername.yaml`), lines.join("\n")); files++;
}

console.log(`generated ${files} Hebrew letter lessons (full א-ת, one per category) into ${DIR}`);
