// Generates Math lessons for BrightKids from the Negba curriculum categories
// (grades 1-6). Procedural so every answer is correct. Instructions are in
// Hebrew (locale he-IL); equations/numbers render LTR. Run:
//   node scripts/gen-math.mjs
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../content/math");
mkdirSync(OUT, { recursive: true });
// Clear previous generated lessons (keep .gitkeep).
for (const f of readdirSync(OUT)) if (f.endsWith(".yaml")) rmSync(resolve(OUT, f));

// Seeded RNG (mulberry32) for stable output.
let _s = 12345;
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
const pad = (n) => String(n).padStart(2, "0");
const REWARD3 = "reward: { stars: 3, sfx: ding, effect: confetti }";
const REWARD1 = "reward: { stars: 1, sfx: ding, effect: confetti }";

let total = 0, problems = 0;
function write(id, lines) { writeFileSync(resolve(OUT, `${id}.yaml`), lines.join("\n") + "\n"); total++; }
function base(id, grade, diff, title, activity, prompt) {
  return [`id: ${id}`, `subject: math`, `grade: ${grade}`, `difficulty: ${diff}`,
    `locale: he-IL`, `direction: ltr`, `title: "${title}"`, `activity: ${activity}`, `prompt_tts: "${prompt}"`];
}

// distinct distractors near `ans`, within [min,max]
function near(ans, count, { min = 0, max = Infinity } = {}) {
  const set = new Set();
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10]) {
    const v = ans + d; if (v >= min && v <= max && v !== ans) set.add(v);
    if (set.size >= count) break;
  }
  let g = min;
  while (set.size < count && g <= max) { if (g !== ans) set.add(g); g++; }
  return [...set].slice(0, count);
}

// Multiple-choice lesson. opts: {title, prompt, glyph?, correct, distractors, correctTts?}
function mc(id, grade, diff, o) {
  const items = shuffle([{ v: o.correct, c: true, tts: o.correctTts }, ...o.distractors.map((d) => ({ v: d }))]);
  const lines = base(id, grade, diff, o.title, "multiple-choice", o.prompt);
  if (o.glyph !== undefined) lines.push(`glyph: "${o.glyph}"`);
  lines.push("items:");
  items.forEach((it, i) => {
    let s = `  - { id: o${i + 1}, label: "${it.v}"`;
    if (it.c) s += ", correct: true";
    if (it.tts) s += `, tts: "${it.tts}"`;
    lines.push(s + " }");
  });
  lines.push(REWARD1);
  write(id, lines);
}

function arithSet(id, grade, diff, title, prompt, list) {
  const lines = base(id, grade, diff, title, "arithmetic", prompt);
  lines.push("problems:");
  list.forEach((p) => lines.push(`  - { operands: [${p.o.join(", ")}], operator: "${p.op}", answer: ${p.a} }`));
  lines.push(REWARD3);
  write(id, lines);
  problems += list.length;
}

function cmpSet(id, grade, diff, n, max) {
  const seen = new Set(); const pairs = [];
  while (pairs.length < n) {
    const a = 1 + Math.floor(rand() * max), b = 1 + Math.floor(rand() * max);
    if (a === b) continue;
    const k = a < b ? `${a},${b}` : `${b},${a}`; if (seen.has(k)) continue;
    seen.add(k); pairs.push([a, b]);
  }
  const setNo = id.slice(-2);
  const lines = base(id, grade, diff, `מִי גָּדוֹל יוֹתֵר? — סֵט ${Number(setNo)}`, "comparison",
    "הַקִּישׁוּ עַל הַמִּסְפָּר הַגָּדוֹל יוֹתֵר");
  lines.push("comparisons:");
  pairs.forEach(([a, b]) => lines.push(`  - { left: ${a}, right: ${b} }`));
  lines.push(REWARD3);
  write(id, lines);
}

function counting(id, grade, glyph, answer, what) {
  const lines = base(id, grade, 1, `כַּמָּה ${what}?`, "counting", `כַּמָּה ${what} אַתֶּם רוֹאִים?`);
  lines.push(`glyph: "${glyph}"`, "problem:", "  operator: count", `  answer: ${answer}`, REWARD1);
  write(id, lines);
}

// ---- problem pools ----
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function pick(pool, n) { return shuffle(pool).slice(0, n); }
function addPool(lo, hi, maxSum) {
  const out = [];
  for (let a = lo; a <= hi; a++) for (let b = lo; b <= hi; b++) if (a + b <= maxSum) out.push({ o: [a, b], op: "+", a: a + b });
  return out;
}
function addRange(lo, hi) {
  const out = [];
  for (let a = lo; a <= hi; a += 7) for (let b = lo; b <= hi; b += 11) out.push({ o: [a, b], op: "+", a: a + b });
  return out;
}
function subPool(lo, hi, step = 1, bstep = 1) {
  const out = [];
  for (let a = lo; a <= hi; a += step) for (let b = 1; b < a; b += bstep) out.push({ o: [a, b], op: "-", a: a - b });
  return out;
}
function mulPool(tables, maxB) {
  const out = [];
  for (const a of tables) for (let b = 1; b <= maxB; b++) out.push({ o: [a, b], op: "x", a: a * b });
  return out;
}
function divPool(divs, maxQ) {
  const out = [];
  for (const b of divs) for (let a = 1; a <= maxQ; a++) out.push({ o: [a * b, b], op: "/", a });
  return out;
}

const P_ADD = "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִבּוּר";
const P_SUB = "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִסּוּר";
const P_MUL = "פִּתְרוּ אֶת תַּרְגִּילֵי הַכֶּפֶל";
const P_DIV = "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִלּוּק";

// ===================== GRADE 1 =====================
counting("math-g1-count-r01", 1, "🍎", 3, "תַּפּוּחִים");
counting("math-g1-count-r02", 1, "⭐", 5, "כּוֹכָבִים");
counting("math-g1-count-r03", 1, "🐠", 7, "דָּגִים");
cmpSet("math-g1-cmp-01", 1, 1, 12, 10);
cmpSet("math-g1-cmp-02", 1, 1, 12, 10);
// number recognition (target spoken, not shown)
for (const [i, n] of [3, 7, 9].entries())
  mc(`math-g1-num-r0${i + 1}`, 1, 1, {
    title: "מִצְאוּ אֶת הַמִּסְפָּר", prompt: `מִצְאוּ אֶת הַמִּסְפָּר ${n}`,
    correct: n, distractors: near(n, 3, { min: 0, max: 12 }),
  });
// successor / predecessor
mc("math-g1-succ-r01", 1, 2, { title: "הַמִּסְפָּר הַבָּא", prompt: "אֵיזֶה מִסְפָּר בָּא אַחֲרֵי הַמִּסְפָּר?", glyph: "6", correct: 7, distractors: [5, 8, 6] });
mc("math-g1-succ-r02", 1, 2, { title: "הַמִּסְפָּר הַבָּא", prompt: "אֵיזֶה מִסְפָּר בָּא אַחֲרֵי הַמִּסְפָּר?", glyph: "9", correct: 10, distractors: [8, 11, 19] });
mc("math-g1-pred-r01", 1, 2, { title: "הַמִּסְפָּר הַקּוֹדֵם", prompt: "אֵיזֶה מִסְפָּר בָּא לִפְנֵי הַמִּסְפָּר?", glyph: "8", correct: 7, distractors: [9, 6, 8] });
// sequences (jumps)
mc("math-g1-seq-r01", 1, 2, { title: "מָה מַמְשִׁיךְ אֶת הַסִּדְרָה?", prompt: "אֵיזֶה מִסְפָּר מַמְשִׁיךְ אֶת הַסִּדְרָה?", glyph: "2, 4, 6, ?", correct: 8, distractors: [7, 10, 9] });
mc("math-g1-seq-r02", 1, 2, { title: "מָה מַמְשִׁיךְ אֶת הַסִּדְרָה?", prompt: "אֵיזֶה מִסְפָּר מַמְשִׁיךְ אֶת הַסִּדְרָה?", glyph: "5, 10, 15, ?", correct: 20, distractors: [16, 25, 18] });
// even / odd
mc("math-g1-even-r01", 1, 2, { title: "זוּגִי אוֹ אִי־זוּגִי?", prompt: "הַאִם הַמִּסְפָּר זוּגִי אוֹ אִי־זוּגִי?", glyph: "8", correct: "זוּגִי", distractors: ["אִי־זוּגִי"] });
mc("math-g1-even-r02", 1, 2, { title: "זוּגִי אוֹ אִי־זוּגִי?", prompt: "הַאִם הַמִּסְפָּר זוּגִי אוֹ אִי־זוּגִי?", glyph: "7", correct: "אִי־זוּגִי", distractors: ["זוּגִי"] });
arithSet("math-g1-add-set-01", 1, 1, "חִבּוּר עַד 10 — סֵט 1", P_ADD, pick(addPool(1, 9, 10), 12));
arithSet("math-g1-add-set-02", 1, 1, "חִבּוּר עַד 10 — סֵט 2", P_ADD, pick(addPool(1, 9, 10), 12));
arithSet("math-g1-sub-set-01", 1, 1, "חִסּוּר עַד 10 — סֵט 1", P_SUB, pick(subPool(2, 10), 12));
arithSet("math-g1-sub-set-02", 1, 1, "חִסּוּר עַד 10 — סֵט 2", P_SUB, pick(subPool(2, 10), 12));
// word problems
mc("math-g1-word-r01", 1, 2, { title: "בְּעָיָה מִלּוּלִית", prompt: "בַּגִּנָּה הָיוּ 4 פְּרָחִים וְצָמְחוּ עוֹד 3. כַּמָּה פְּרָחִים יֵשׁ עַכְשָׁיו?", correct: 7, distractors: [6, 8, 5] });
mc("math-g1-word-r02", 1, 2, { title: "בְּעָיָה מִלּוּלִית", prompt: "לְדָנָה הָיוּ 9 בָּלוֹנִים וְ-2 הִתְפּוֹצְצוּ. כַּמָּה נִשְׁאֲרוּ?", correct: 7, distractors: [8, 6, 11] });
// clock (hour emojis)
mc("math-g1-clock-r01", 1, 2, { title: "מָה הַשָּׁעָה?", prompt: "מָה הַשָּׁעָה?", glyph: "🕒", correct: 3, distractors: [2, 4, 5] });
mc("math-g1-clock-r02", 1, 2, { title: "מָה הַשָּׁעָה?", prompt: "מָה הַשָּׁעָה?", glyph: "🕗", correct: 8, distractors: [7, 9, 6] });

// ===================== GRADE 2 =====================
// place value (tens & units)
mc("math-g2-place-r01", 2, 2, { title: "כַּמָּה עֲשָׂרוֹת?", prompt: "כַּמָּה עֲשָׂרוֹת יֵשׁ בַּמִּסְפָּר?", glyph: "47", correct: 4, distractors: [7, 3, 5] });
mc("math-g2-place-r02", 2, 2, { title: "כַּמָּה יְחִידוֹת?", prompt: "כַּמָּה יְחִידוֹת יֵשׁ בַּמִּסְפָּר?", glyph: "63", correct: 3, distractors: [6, 2, 4] });
arithSet("math-g2-add-set-01", 2, 2, "חִבּוּר עַד 20 — סֵט 1", P_ADD, pick(addPool(2, 19, 20), 12));
arithSet("math-g2-add-set-02", 2, 2, "חִבּוּר עַד 100 — סֵט 1", P_ADD, pick(addRange(10, 89), 12));
arithSet("math-g2-sub-set-01", 2, 2, "חִסּוּר עַד 20 — סֵט 1", P_SUB, pick(subPool(11, 20), 12));
arithSet("math-g2-sub-set-02", 2, 2, "חִסּוּר עַד 100 — סֵט 1", P_SUB, pick(subPool(20, 99, 7, 5), 12));
arithSet("math-g2-mul-set-01", 2, 2, "כֶּפֶל בְּ-2, 5, 10 — סֵט 1", P_MUL, pick(mulPool([2, 5, 10], 10), 12));
arithSet("math-g2-mul-set-02", 2, 2, "כֶּפֶל בְּ-2, 5, 10 — סֵט 2", P_MUL, pick(mulPool([2, 5, 10], 10), 12));
cmpSet("math-g2-cmp-01", 2, 2, 12, 20);
mc("math-g2-even-r01", 2, 2, { title: "זוּגִי אוֹ אִי־זוּגִי?", prompt: "הַאִם הַמִּסְפָּר זוּגִי אוֹ אִי־זוּגִי?", glyph: "14", correct: "זוּגִי", distractors: ["אִי־זוּגִי"] });
mc("math-g2-seq-r01", 2, 2, { title: "מָה מַמְשִׁיךְ אֶת הַסִּדְרָה?", prompt: "אֵיזֶה מִסְפָּר מַמְשִׁיךְ אֶת הַסִּדְרָה?", glyph: "10, 20, 30, ?", correct: 40, distractors: [35, 50, 31] });
mc("math-g2-half-r01", 2, 2, { title: "חֲצִי", prompt: "כַּמָּה זֶה חֲצִי?", glyph: "½ מ-8", correct: 4, distractors: [2, 6, 3] });
mc("math-g2-word-r01", 2, 2, { title: "בְּעָיָה מִלּוּלִית", prompt: "בְּכִתָּה יֵשׁ 5 שֻׁלְחָנוֹת וְעַל כָּל אֶחָד 2 סְפָרִים. כַּמָּה סְפָרִים בְּסַךְ הַכֹּל?", correct: 10, distractors: [7, 12, 8] });
mc("math-g2-word-r02", 2, 2, { title: "בְּעָיָה מִלּוּלִית", prompt: "הָיוּ 18 עוּגִיּוֹת וְאָכְלוּ 6. כַּמָּה נִשְׁאֲרוּ?", correct: 12, distractors: [11, 13, 24] });

// ===================== GRADE 3 =====================
arithSet("math-g3-mul-set-01", 3, 2, "לוּחַ הַכֶּפֶל — סֵט 1", P_MUL, pick(mulPool([3, 4, 6], 10), 12));
arithSet("math-g3-mul-set-02", 3, 2, "לוּחַ הַכֶּפֶל — סֵט 2", P_MUL, pick(mulPool([7, 8, 9], 10), 12));
arithSet("math-g3-div-set-01", 3, 2, "חִלּוּק — סֵט 1", P_DIV, pick(divPool([2, 3, 4, 5], 10), 12));
arithSet("math-g3-div-set-02", 3, 2, "חִלּוּק — סֵט 2", P_DIV, pick(divPool([6, 7, 8, 10], 10), 12));
arithSet("math-g3-add-set-01", 3, 2, "חִבּוּר תְּלַת־סִפְרָתִי — סֵט 1", P_ADD, pick(addRange(100, 899), 12));
arithSet("math-g3-sub-set-01", 3, 2, "חִסּוּר דּוּ־סִפְרָתִי — סֵט 1", P_SUB, pick(subPool(30, 99, 5, 7), 12));
mc("math-g3-ops-r01", 3, 3, { title: "סֵדֶר פְּעוּלוֹת", prompt: "פִּתְרוּ אֶת הַתַּרְגִּיל לְפִי סֵדֶר הַפְּעוּלוֹת", glyph: "2 + 3 × 4", correct: 14, distractors: [20, 24, 9] });
mc("math-g3-ops-r02", 3, 3, { title: "סֵדֶר פְּעוּלוֹת", prompt: "פִּתְרוּ אֶת הַתַּרְגִּיל לְפִי סֵדֶר הַפְּעוּלוֹת", glyph: "10 - 2 × 3", correct: 4, distractors: [24, 8, 6 ] });
mc("math-g3-seq-r01", 3, 2, { title: "מָה מַמְשִׁיךְ אֶת הַסִּדְרָה?", prompt: "אֵיזֶה מִסְפָּר מַמְשִׁיךְ אֶת הַסִּדְרָה?", glyph: "3, 6, 9, ?", correct: 12, distractors: [10, 15, 11] });
mc("math-g3-round-r01", 3, 3, { title: "עִגּוּל לַעֲשָׂרוֹת", prompt: "עַגְּלוּ אֶת הַמִּסְפָּר לָעֲשָׂרוֹת", glyph: "47", correct: 50, distractors: [40, 60, 45] });
mc("math-g3-word-r01", 3, 3, { title: "בְּעָיָה מִלּוּלִית", prompt: "3 חֲבֵרִים חִלְּקוּ 12 סֻכָּרִיּוֹת בְּשָׁוֶה. כַּמָּה קִבֵּל כָּל אֶחָד?", correct: 4, distractors: [3, 6, 9] });
mc("math-g3-word-r02", 3, 3, { title: "בְּעָיָה מִלּוּלִית", prompt: "בְּקֻפְסָה 6 שׁוּרוֹת שֶׁל 4 שׁוֹקוֹלָדִים. כַּמָּה שׁוֹקוֹלָדִים בַּקֻּפְסָה?", correct: 24, distractors: [10, 20, 18] });
mc("math-g3-clock-r01", 3, 2, { title: "מָה הַשָּׁעָה?", prompt: "מָה הַשָּׁעָה?", glyph: "🕕", correct: 6, distractors: [5, 7, 12] });

// ===================== GRADE 4 =====================
arithSet("math-g4-mul-set-01", 4, 3, "כֶּפֶל עַד 12 — סֵט 1", P_MUL, pick(mulPool(range(6, 12), 12), 12));
arithSet("math-g4-mul-set-02", 4, 3, "כֶּפֶל עַד 12 — סֵט 2", P_MUL, pick(mulPool(range(2, 12), 12), 12));
arithSet("math-g4-div-set-01", 4, 3, "חִלּוּק עַד 12 — סֵט 1", P_DIV, pick(divPool(range(2, 12), 12), 12));
arithSet("math-g4-add-set-01", 4, 3, "חִבּוּר תְּלַת־סִפְרָתִי — סֵט 1", P_ADD, pick(addRange(100, 899), 12));
mc("math-g4-place-r01", 4, 3, { title: "עֵרֶךְ הַסִּפְרָה", prompt: "מָה עֵרֶךְ סִפְרַת הַמֵּאוֹת?", glyph: "352", correct: 300, distractors: [3, 30, 3000] });
mc("math-g4-round-r01", 4, 3, { title: "עִגּוּל לַמֵּאוֹת", prompt: "עַגְּלוּ אֶת הַמִּסְפָּר לַמֵּאוֹת", glyph: "278", correct: 300, distractors: [200, 280, 270] });
mc("math-g4-round-r02", 4, 3, { title: "אֹמֶד", prompt: "בְּעֵרֶךְ, כַּמָּה זֶה?", glyph: "39 + 41", correct: 80, distractors: [70, 90, 100] });
mc("math-g4-frac-r01", 4, 3, { title: "שֶׁבֶר", prompt: "כַּמָּה זֶה רֶבַע?", glyph: "¼ מ-12", correct: 3, distractors: [4, 6, 2] });
mc("math-g4-frac-r02", 4, 3, { title: "שֶׁבֶר", prompt: "כַּמָּה זֶה שְׁלִישׁ?", glyph: "⅓ מ-9", correct: 3, distractors: [2, 4, 6] });
mc("math-g4-ops-r01", 4, 3, { title: "סֵדֶר פְּעוּלוֹת", prompt: "פִּתְרוּ לְפִי סֵדֶר הַפְּעוּלוֹת", glyph: "(4 + 2) × 3", correct: 18, distractors: [10, 14, 24] });
mc("math-g4-word-r01", 4, 3, { title: "בְּעָיָה מִלּוּלִית", prompt: "מַחְבֶּרֶת עוֹלָה 7 שְׁקָלִים. כַּמָּה יַעֲלוּ 6 מַחְבָּרוֹת?", correct: 42, distractors: [13, 36, 48] });

// ===================== GRADE 5 =====================
mc("math-g5-frac-r01", 5, 3, { title: "הַשְׁווּ שְׁבָרִים", prompt: "אֵיזֶה שֶׁבֶר גָּדוֹל יוֹתֵר?", glyph: "1/2 ? 1/3", correct: "1/2", distractors: ["1/3"] });
mc("math-g5-frac-r02", 5, 3, { title: "חֲצִי", prompt: "כַּמָּה זֶה חֲצִי?", glyph: "½ מ-24", correct: 12, distractors: [8, 6, 48] });
mc("math-g5-dec-r01", 5, 3, { title: "שְׁבָרִים עֶשְׂרוֹנִיִּים", prompt: "כַּמָּה זֶה?", glyph: "0.3 + 0.4", correct: "0.7", distractors: ["0.1", "0.34", "7"] });
mc("math-g5-dec-r02", 5, 3, { title: "שְׁבָרִים עֶשְׂרוֹנִיִּים", prompt: "כַּמָּה זֶה?", glyph: "1.5 + 0.5", correct: "2", distractors: ["1.10", "1", "2.5"] });
arithSet("math-g5-mul-set-01", 5, 3, "כֶּפֶל גָּדוֹל — סֵט 1", P_MUL, pick(mulPool(range(11, 20), 9), 12));
arithSet("math-g5-div-set-01", 5, 3, "חִלּוּק — סֵט 1", P_DIV, pick(divPool(range(6, 12), 12), 12));
mc("math-g5-ops-r01", 5, 3, { title: "סֵדֶר פְּעוּלוֹת", prompt: "פִּתְרוּ לְפִי סֵדֶר הַפְּעוּלוֹת", glyph: "20 - 3 × 4 + 2", correct: 10, distractors: [70, 14, 8] });
mc("math-g5-large-r01", 5, 3, { title: "מִסְפָּרִים גְּדוֹלִים", prompt: "אֵיזֶה מִסְפָּר גָּדוֹל יוֹתֵר?", glyph: "4512 ? 4521", correct: 4521, distractors: [4512] });

// ===================== GRADE 6 =====================
mc("math-g6-frac-r01", 6, 3, { title: "חִבּוּר שְׁבָרִים", prompt: "כַּמָּה זֶה?", glyph: "1/4 + 1/4", correct: "1/2", distractors: ["2/8", "1/8", "2/4"] });
mc("math-g6-frac-r02", 6, 3, { title: "הַשְׁווּ שְׁבָרִים", prompt: "אֵיזֶה שֶׁבֶר גָּדוֹל יוֹתֵר?", glyph: "3/4 ? 2/3", correct: "3/4", distractors: ["2/3"] });
mc("math-g6-dec-r01", 6, 3, { title: "כֶּפֶל עֶשְׂרוֹנִי", prompt: "כַּמָּה זֶה?", glyph: "0.2 × 3", correct: "0.6", distractors: ["0.5", "6", "0.23"] });
mc("math-g6-dec-r02", 6, 3, { title: "שְׁבָרִים עֶשְׂרוֹנִיִּים", prompt: "כַּמָּה זֶה?", glyph: "2.5 - 0.5", correct: "2", distractors: ["2.5", "3", "1.5"] });
mc("math-g6-ops-r01", 6, 3, { title: "סֵדֶר פְּעוּלוֹת", prompt: "פִּתְרוּ לְפִי סֵדֶר הַפְּעוּלוֹת", glyph: "6 + 12 / 3 - 2", correct: 8, distractors: [4, 12, 6] });
mc("math-g6-line-r01", 6, 3, { title: "צִיר הַמִּסְפָּרִים", prompt: "אֵיזֶה מִסְפָּר נִמְצָא בְּדִיּוּק בָּאֶמְצַע?", glyph: "0 ... ? ... 10", correct: 5, distractors: [4, 6, 1] });
mc("math-g6-unknown-r01", 6, 3, { title: "מַהוּ הַנֶּעְלָם?", prompt: "אֵיזֶה מִסְפָּר מַשְׁלִים אֶת הַתַּרְגִּיל?", glyph: "? + 7 = 15", correct: 8, distractors: [22, 7, 9] });

console.log(`generated ${total} math lessons (${problems} arithmetic problems) into ${OUT}`);
