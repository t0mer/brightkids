// Generates Math lessons for BrightKids from the Negba curriculum categories
// (grades 1-6). Procedural so every answer is correct. Instructions are in
// Hebrew (locale he-IL); equations/numbers render LTR.
//
// Concept categories are emitted as multiple-choice SETS: each lesson holds
// several (4-5) questions from the same category, presented in a randomized
// order by the frontend. Arithmetic and "who is bigger?" are also sets.
//
//   node scripts/gen-math.mjs
import { writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../content/math");
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".yaml")) rmSync(resolve(OUT, f));

// Seeded RNG (mulberry32).
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
function chunk(a, n) { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; }
const pad = (n) => String(n).padStart(2, "0");
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const REWARD3 = "reward: { stars: 3, sfx: ding, effect: confetti }";
let total = 0, problems = 0, questions = 0;

function write(id, lines) { writeFileSync(resolve(OUT, `${id}.yaml`), lines.join("\n") + "\n"); total++; }
function base(id, grade, diff, title, activity, prompt) {
  return [`id: ${id}`, `subject: math`, `grade: ${grade}`, `difficulty: ${diff}`,
    `locale: he-IL`, `direction: ltr`, `title: "${title}"`, `activity: ${activity}`, `prompt_tts: "${prompt}"`];
}

// distinct numeric distractors near `ans`, within [min,max]
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

// ---------- multiple-choice question sets ----------
// q: { glyph?, prompt?, promptText?, correct, distractors, correctTts? }
function qLines(q) {
  const fields = [];
  if (q.prompt) fields.push(`prompt: "${q.prompt}"`);
  if (q.promptText) fields.push(`prompt_text: "${q.promptText}"`);
  if (q.glyph !== undefined && q.glyph !== "") fields.push(`glyph: "${q.glyph}"`);
  const lines = [`  - ${fields[0]}`];
  for (let i = 1; i < fields.length; i++) lines.push(`    ${fields[i]}`);
  lines.push("    items:");
  const opts = [{ v: q.correct, c: true, tts: q.correctTts }, ...q.distractors.map((d) => ({ v: d }))];
  opts.forEach((o, i) => {
    let s = `      - { id: o${i + 1}, label: "${o.v}"`;
    if (o.c) s += ", correct: true";
    if (o.tts) s += `, tts: "${o.tts}"`;
    lines.push(s + " }");
  });
  return lines;
}
// ONE multiple-choice lesson per category holding the whole question pool. The
// app samples a handful per play and lets the child shuffle for more.
function mcOne(catKey, grade, diff, title, prompt, pool) {
  const id = `math-g${grade}-${catKey}`;
  const lines = base(id, grade, diff, title, "multiple-choice", prompt);
  lines.push("questions:");
  pool.forEach((q) => lines.push(...qLines(q)));
  lines.push(REWARD3);
  write(id, lines); questions += pool.length;
}

// ONE arithmetic lesson per category holding a large problem pool.
function arithOne(catKey, grade, diff, title, prompt, list) {
  const id = `math-g${grade}-${catKey}`;
  const lines = base(id, grade, diff, title, "arithmetic", prompt);
  lines.push("problems:");
  list.forEach((p) => lines.push(`  - { operands: [${p.o.join(", ")}], operator: "${p.op}", answer: ${p.a} }`));
  lines.push(REWARD3);
  write(id, lines); problems += list.length;
}

// ONE "who is bigger?" lesson per grade holding a large pair pool.
function cmpOne(grade, diff, n, max) {
  const seen = new Set(); const pairs = [];
  while (pairs.length < n) {
    const a = 1 + Math.floor(rand() * max), b = 1 + Math.floor(rand() * max);
    if (a === b) continue;
    const k = a < b ? `${a},${b}` : `${b},${a}`; if (seen.has(k)) continue;
    seen.add(k); pairs.push([a, b]);
  }
  const id = `math-g${grade}-cmp`;
  const lines = base(id, grade, diff, "מִי גָּדוֹל יוֹתֵר?", "comparison",
    "הַקִּישׁוּ עַל הַמִּסְפָּר הַגָּדוֹל יוֹתֵר");
  lines.push("comparisons:");
  pairs.forEach(([a, b]) => lines.push(`  - { left: ${a}, right: ${b} }`));
  lines.push(REWARD3); write(id, lines);
}
function counting(id, grade, glyph, answer, what) {
  const lines = base(id, grade, 1, `כַּמָּה ${what}?`, "counting", `כַּמָּה ${what} אַתֶּם רוֹאִים?`);
  lines.push(`glyph: "${glyph}"`, "problem:", "  operator: count", `  answer: ${answer}`,
    "reward: { stars: 1, sfx: ding, effect: confetti }");
  write(id, lines);
}

// problem pools
const pick = (pool, n) => shuffle(pool).slice(0, n);
function addPool(lo, hi, maxSum) { const o = []; for (let a = lo; a <= hi; a++) for (let b = lo; b <= hi; b++) if (a + b <= maxSum) o.push({ o: [a, b], op: "+", a: a + b }); return o; }
function addRange(lo, hi) { const o = []; for (let a = lo; a <= hi; a += 7) for (let b = lo; b <= hi; b += 11) o.push({ o: [a, b], op: "+", a: a + b }); return o; }
function subPool(lo, hi, st = 1, bs = 1) { const o = []; for (let a = lo; a <= hi; a += st) for (let b = 1; b < a; b += bs) o.push({ o: [a, b], op: "-", a: a - b }); return o; }
function mulPool(tables, maxB) { const o = []; for (const a of tables) for (let b = 1; b <= maxB; b++) o.push({ o: [a, b], op: "x", a: a * b }); return o; }
function divPool(divs, maxQ) { const o = []; for (const b of divs) for (let a = 1; a <= maxQ; a++) o.push({ o: [a * b, b], op: "/", a }); return o; }

const P_ADD = "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִבּוּר";
const P_SUB = "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִסּוּר";
const P_MUL = "פִּתְרוּ אֶת תַּרְגִּילֵי הַכֶּפֶל";
const P_DIV = "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִלּוּק";

// ---------- concept category pools ----------
const EVEN = "זוּגִי", ODD = "אִי־זוּגִי";
// Interleave even and odd so every set is balanced (kept in order via shuffleQs:false).
function evenOddPool(lo, hi) {
  const evens = range(lo, hi).filter((n) => n % 2 === 0);
  const odds = range(lo, hi).filter((n) => n % 2 === 1);
  const inter = [];
  for (let i = 0; i < Math.max(evens.length, odds.length); i++) {
    if (evens[i] !== undefined) inter.push(evens[i]);
    if (odds[i] !== undefined) inter.push(odds[i]);
  }
  return inter.map((n) => ({ glyph: String(n), correct: n % 2 === 0 ? EVEN : ODD, distractors: [n % 2 === 0 ? ODD : EVEN] }));
}
function succPool(lo, hi) {
  return range(lo, hi).map((n) => ({ glyph: String(n), correct: n + 1, distractors: near(n + 1, 3, { min: 0, max: hi + 5 }) }));
}
function predPool(lo, hi) {
  return range(lo, hi).map((n) => ({ glyph: String(n), correct: n - 1, distractors: near(n - 1, 3, { min: 0, max: hi }) }));
}
function seqPool(steps, starts, maxAns) {
  const out = [];
  for (const s of steps) for (const a of starts) {
    const ans = a + 3 * s;
    out.push({ glyph: `${a}, ${a + s}, ${a + 2 * s}, ?`, correct: ans, distractors: near(ans, 3, { min: 0, max: maxAns }) });
  }
  return out;
}
function numRecPool(lo, hi) {
  return range(lo, hi).map((n) => ({
    prompt: `מִצְאוּ אֶת הַמִּסְפָּר ${n}`,
    promptText: "מִצְאוּ אֶת הַמִּסְפָּר",
    correct: n, distractors: near(n, 3, { min: 0, max: hi + 3 }),
  }));
}
function tensPool(nums) { return nums.map((n) => ({ glyph: String(n), correct: Math.floor(n / 10) % 10, distractors: near(Math.floor(n / 10) % 10, 3, { min: 0, max: 9 }) })); }
function unitsPool(nums) { return nums.map((n) => ({ glyph: String(n), correct: n % 10, distractors: near(n % 10, 3, { min: 0, max: 9 }) })); }
function roundPool(nums, to) {
  return nums.map((n) => { const r = Math.round(n / to) * to; return { glyph: String(n), correct: r, distractors: near(r, 3, { min: 0, max: 10000 }).map((x) => Math.round(x / to) * to).filter((x) => x !== r).slice(0, 3) }; })
    .map((q) => ({ ...q, distractors: q.distractors.length >= 2 ? q.distractors : near(q.correct, 3, { min: 0 }) }));
}
function fracPool(nums, denom, sym) {
  return nums.map((n) => ({ glyph: `${sym} מ-${n}`, correct: n / denom, distractors: near(n / denom, 3, { min: 0, max: n }) }));
}
const CLOCK = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"];
function clockPool(hours) {
  return hours.map((h) => ({ glyph: CLOCK[h % 12], correct: h, distractors: near(h, 3, { min: 1, max: 12 }) }));
}
function opsPool(specs) {
  // specs: [a,b,c,type] type: 0 a+b*c, 1 a*b+c, 2 a-b*c, 3 (a+b)*c
  return specs.map(([a, b, c, type]) => {
    let glyph, ans, ltr;
    if (type === 0) { glyph = `${a} + ${b} × ${c}`; ans = a + b * c; ltr = (a + b) * c; }
    else if (type === 1) { glyph = `${a} × ${b} + ${c}`; ans = a * b + c; ltr = a * (b + c); }
    else if (type === 2) { glyph = `${a} - ${b} × ${c}`; ans = a - b * c; ltr = (a - b) * c; }
    else { glyph = `(${a} + ${b}) × ${c}`; ans = (a + b) * c; ltr = a + b * c; }
    const ds = new Set([ltr, ans + 1, ans - 1, ans + 2].filter((x) => x !== ans && x >= 0));
    return { glyph, correct: ans, distractors: [...ds].slice(0, 3) };
  });
}
function signPool(pairs) {
  return pairs.map(([a, b]) => ({ glyph: `${a} _ ${b}`, correct: a < b ? "<" : a > b ? ">" : "=", distractors: a < b ? [">", "="] : a > b ? ["<", "="] : ["<", ">"] }));
}
// word problems: [{p, a, d}] -> one "בעיות מילוליות" lesson per grade.
function wordSets(grade, diff, list) {
  mcOne("word", grade, diff, "בְּעָיוֹת מִלּוּלִיּוֹת", "פִּתְרוּ אֶת הַבְּעָיוֹת",
    list.map((w) => ({ prompt: w.p, promptText: w.p, correct: w.a, distractors: w.d })));
}

const T_EVEN = ["זוּגִי אוֹ אִי־זוּגִי?", "הַאִם הַמִּסְפָּר זוּגִי אוֹ אִי־זוּגִי?"];
const T_SUCC = ["הַמִּסְפָּר הַבָּא", "אֵיזֶה מִסְפָּר בָּא אַחֲרֵי הַמִּסְפָּר?"];
const T_PRED = ["הַמִּסְפָּר הַקּוֹדֵם", "אֵיזֶה מִסְפָּר בָּא לִפְנֵי הַמִּסְפָּר?"];
const T_SEQ = ["מָה מַמְשִׁיךְ אֶת הַסִּדְרָה?", "אֵיזֶה מִסְפָּר מַמְשִׁיךְ אֶת הַסִּדְרָה?"];
const T_NUM = ["מִצְאוּ אֶת הַמִּסְפָּר", "מִצְאוּ אֶת הַמִּסְפָּר שֶׁאַתֶּם שׁוֹמְעִים"];
const T_CLOCK = ["מָה הַשָּׁעָה?", "מָה הַשָּׁעָה?"];
const T_OPS = ["סֵדֶר פְּעוּלוֹת", "פִּתְרוּ לְפִי סֵדֶר הַפְּעוּלוֹת"];

// ===================== GRADE 1 =====================
counting("math-g1-count-r01", 1, "🍎", 3, "תַּפּוּחִים");
counting("math-g1-count-r02", 1, "⭐", 5, "כּוֹכָבִים");
counting("math-g1-count-r03", 1, "🐠", 7, "דָּגִים");
mcOne("even", 1, 2, ...T_EVEN, evenOddPool(1, 10));
mcOne("succ", 1, 1, ...T_SUCC, succPool(1, 19));
mcOne("pred", 1, 1, ...T_PRED, predPool(2, 20));
mcOne("seq", 1, 2, ...T_SEQ, seqPool([2, 5, 10], [1, 2, 3, 4], 60));
mcOne("num", 1, 1, ...T_NUM, numRecPool(1, 12));
mcOne("clock", 1, 2, ...T_CLOCK, clockPool(range(1, 12)));
cmpOne(1, 1, 24, 10);
arithOne("add", 1, 1, "חִבּוּר עַד 10", P_ADD, pick(addPool(1, 9, 10), 24));
arithOne("sub", 1, 1, "חִסּוּר עַד 10", P_SUB, pick(subPool(2, 10), 24));
wordSets(1, 2, [
  { p: "בַּגִּנָּה הָיוּ 4 פְּרָחִים וְצָמְחוּ עוֹד 3. כַּמָּה פְּרָחִים יֵשׁ עַכְשָׁיו?", a: 7, d: [6, 8, 5] },
  { p: "לְדָנָה הָיוּ 9 בָּלוֹנִים וְ-2 הִתְפּוֹצְצוּ. כַּמָּה נִשְׁאֲרוּ?", a: 7, d: [8, 6, 11] },
  { p: "עַל הָעֵץ יֵשׁ 5 צִפּוֹרִים וְהִגִּיעוּ עוֹד 4. כַּמָּה צִפּוֹרִים עַל הָעֵץ?", a: 9, d: [8, 10, 1] },
  { p: "הָיוּ 8 עוּגִיּוֹת וְאָכַלְתִּי 3. כַּמָּה נִשְׁאֲרוּ?", a: 5, d: [4, 6, 11] },
], 1);

// ===================== GRADE 2 =====================
mcOne("place-tens", 2, 2, "כַּמָּה עֲשָׂרוֹת?", "כַּמָּה עֲשָׂרוֹת יֵשׁ בַּמִּסְפָּר?", tensPool([47, 63, 28, 91, 35, 72, 56, 84]));
mcOne("place-units", 2, 2, "כַּמָּה יְחִידוֹת?", "כַּמָּה יְחִידוֹת יֵשׁ בַּמִּסְפָּר?", unitsPool([47, 63, 28, 91, 35, 72, 56, 84]));
mcOne("even", 2, 2, ...T_EVEN, evenOddPool(10, 30));
mcOne("seq", 2, 2, ...T_SEQ, seqPool([10, 5, 3], [10, 20, 25, 12], 120));
mcOne("sign", 2, 2, "אֵיזֶה סִימָן מַתְאִים?", "אֵיזֶה סִימָן מַתְאִים בֵּין הַמִּסְפָּרִים?", signPool([[4, 7], [9, 3], [6, 6], [12, 8], [5, 11], [10, 10], [15, 9], [7, 13]]));
mcOne("half", 2, 2, "חֲצִי", "כַּמָּה זֶה חֲצִי?", fracPool([4, 6, 8, 10, 12, 14, 16, 20], 2, "½"));
arithOne("add20", 2, 2, "חִבּוּר עַד 20", P_ADD, pick(addPool(2, 19, 20), 24));
arithOne("add100", 2, 2, "חִבּוּר עַד 100", P_ADD, pick(addRange(10, 89), 24));
arithOne("sub20", 2, 2, "חִסּוּר עַד 20", P_SUB, pick(subPool(11, 20), 24));
arithOne("sub100", 2, 2, "חִסּוּר עַד 100", P_SUB, pick(subPool(20, 99, 7, 5), 24));
arithOne("mul", 2, 2, "כֶּפֶל בְּ-2, 5, 10", P_MUL, pick(mulPool([2, 5, 10], 10), 24));
cmpOne(2, 2, 24, 20);
wordSets(2, 2, [
  { p: "בְּכִתָּה יֵשׁ 5 שֻׁלְחָנוֹת וְעַל כָּל אֶחָד 2 סְפָרִים. כַּמָּה סְפָרִים בְּסַךְ הַכֹּל?", a: 10, d: [7, 12, 8] },
  { p: "הָיוּ 18 עוּגִיּוֹת וְאָכְלוּ 6. כַּמָּה נִשְׁאֲרוּ?", a: 12, d: [11, 13, 24] },
  { p: "לְכָל יֶלֶד יֵשׁ 5 גְּלִילוֹת וְיֵשׁ 4 יְלָדִים. כַּמָּה גְּלִילוֹת בְּסַךְ הַכֹּל?", a: 20, d: [9, 16, 25] },
  { p: "בַּחֲנוּת הָיוּ 30 תַּפּוּחִים וּמָכְרוּ 12. כַּמָּה נִשְׁאֲרוּ?", a: 18, d: [22, 17, 42] },
], 1);

// ===================== GRADE 3 =====================
mcOne("ops", 3, 3, ...T_OPS, opsPool([[2, 3, 4, 0], [10, 2, 3, 2], [3, 2, 4, 1], [4, 2, 3, 3], [5, 3, 2, 0], [12, 2, 3, 2], [2, 4, 3, 1], [6, 1, 5, 3]]));
mcOne("seq", 3, 2, ...T_SEQ, seqPool([3, 4, 6, 7], [3, 4, 6, 7], 100));
mcOne("round-tens", 3, 3, "עִגּוּל לַעֲשָׂרוֹת", "עַגְּלוּ אֶת הַמִּסְפָּר לָעֲשָׂרוֹת", roundPool([47, 83, 28, 61, 35, 72, 56, 94], 10));
mcOne("half", 3, 2, "חֲצִי", "כַּמָּה זֶה חֲצִי?", fracPool([10, 16, 20, 24, 30, 40, 50, 100], 2, "½"));
mcOne("quarter", 3, 2, "רֶבַע", "כַּמָּה זֶה רֶבַע?", fracPool([8, 12, 16, 20, 24, 40], 4, "¼"));
mcOne("clock", 3, 2, ...T_CLOCK, clockPool(range(1, 12)));
arithOne("mul", 3, 2, "לוּחַ הַכֶּפֶל", P_MUL, pick(mulPool([3, 4, 6, 7, 8, 9], 10), 24));
arithOne("div", 3, 2, "חִלּוּק", P_DIV, pick(divPool([2, 3, 4, 5, 6, 7, 8, 10], 10), 24));
arithOne("add", 3, 2, "חִבּוּר תְּלַת־סִפְרָתִי", P_ADD, pick(addRange(100, 899), 24));
arithOne("sub", 3, 2, "חִסּוּר דּוּ־סִפְרָתִי", P_SUB, pick(subPool(30, 99, 5, 7), 24));
wordSets(3, 3, [
  { p: "3 חֲבֵרִים חִלְּקוּ 12 סֻכָּרִיּוֹת בְּשָׁוֶה. כַּמָּה קִבֵּל כָּל אֶחָד?", a: 4, d: [3, 6, 9] },
  { p: "בְּקֻפְסָה 6 שׁוּרוֹת שֶׁל 4 שׁוֹקוֹלָדִים. כַּמָּה שׁוֹקוֹלָדִים בַּקֻּפְסָה?", a: 24, d: [10, 20, 18] },
  { p: "מַחְבֶּרֶת עוֹלָה 8 שְׁקָלִים. כַּמָּה יַעֲלוּ 5 מַחְבָּרוֹת?", a: 40, d: [13, 32, 45] },
  { p: "הָיוּ 24 בָּלוֹנִים וְחִלְּקוּ אוֹתָם לְ-4 קְבוּצוֹת שָׁווֹת. כַּמָּה בְּכָל קְבוּצָה?", a: 6, d: [5, 8, 20] },
], 1);

// ===================== GRADE 4 =====================
mcOne("ops", 4, 3, ...T_OPS, opsPool([[4, 2, 3, 3], [20, 3, 4, 2], [5, 4, 2, 1], [2, 5, 3, 0], [6, 2, 4, 3], [30, 5, 2, 2], [3, 3, 3, 1], [8, 2, 5, 0]]));
mcOne("round-hundreds", 4, 3, "עִגּוּל לַמֵּאוֹת", "עַגְּלוּ אֶת הַמִּסְפָּר לַמֵּאוֹת", roundPool([278, 412, 650, 189, 530, 333, 720, 845], 100));
mcOne("quarter", 4, 3, "רֶבַע", "כַּמָּה זֶה רֶבַע?", fracPool([12, 16, 20, 24, 40, 100], 4, "¼"));
mcOne("third", 4, 3, "שְׁלִישׁ", "כַּמָּה זֶה שְׁלִישׁ?", fracPool([9, 12, 15, 18, 30, 60], 3, "⅓"));
arithOne("mul", 4, 3, "כֶּפֶל עַד 12", P_MUL, pick(mulPool(range(2, 12), 12), 24));
arithOne("div", 4, 3, "חִלּוּק עַד 12", P_DIV, pick(divPool(range(2, 12), 12), 24));
arithOne("add", 4, 3, "חִבּוּר תְּלַת־סִפְרָתִי", P_ADD, pick(addRange(100, 899), 24));
wordSets(4, 3, [
  { p: "מַחְבֶּרֶת עוֹלָה 7 שְׁקָלִים. כַּמָּה יַעֲלוּ 6 מַחְבָּרוֹת?", a: 42, d: [13, 36, 48] },
  { p: "בְּאוֹטוֹבּוּס 48 נוֹסְעִים, יָרְדוּ 19. כַּמָּה נִשְׁאֲרוּ?", a: 29, d: [31, 27, 67] },
  { p: "קָנִיתִי 3 חֲבִילוֹת שֶׁל 25 מַדְבֵּקוֹת. כַּמָּה מַדְבֵּקוֹת בְּסַךְ הַכֹּל?", a: 75, d: [28, 50, 100] },
  { p: "144 תַּלְמִידִים הִתְחַלְּקוּ לְ-12 כִּתּוֹת שָׁווֹת. כַּמָּה בְּכָל כִּתָּה?", a: 12, d: [10, 14, 132] },
], 1);

// ===================== GRADE 5 =====================
mcOne("ops", 5, 3, ...T_OPS, opsPool([[20, 3, 4, 2], [4, 5, 2, 1], [6, 2, 4, 0], [30, 4, 5, 2], [5, 5, 3, 3], [10, 2, 6, 2], [3, 6, 4, 1], [8, 3, 2, 0]]));
mcOne("half", 5, 3, "חֲצִי", "כַּמָּה זֶה חֲצִי?", fracPool([24, 30, 50, 80, 100, 120], 2, "½"));
mcOne("frac-cmp", 5, 3, "הַשְׁווּ שְׁבָרִים", "אֵיזֶה שֶׁבֶר גָּדוֹל יוֹתֵר?", [
  { glyph: "1/2 ? 1/3", correct: "1/2", distractors: ["1/3"] },
  { glyph: "3/4 ? 1/4", correct: "3/4", distractors: ["1/4"] },
  { glyph: "2/3 ? 1/3", correct: "2/3", distractors: ["1/3"] },
  { glyph: "1/2 ? 1/4", correct: "1/2", distractors: ["1/4"] },
]);
mcOne("dec", 5, 3, "שְׁבָרִים עֶשְׂרוֹנִיִּים", "כַּמָּה זֶה?", [
  { glyph: "0.3 + 0.4", correct: "0.7", distractors: ["0.1", "0.34", "7"] },
  { glyph: "1.5 + 0.5", correct: "2", distractors: ["1.10", "1", "2.5"] },
  { glyph: "0.6 + 0.2", correct: "0.8", distractors: ["0.4", "0.62", "8"] },
  { glyph: "2.0 - 0.5", correct: "1.5", distractors: ["2.5", "1", "0.5"] },
]);
arithOne("mul", 5, 3, "כֶּפֶל גָּדוֹל", P_MUL, pick(mulPool(range(11, 20), 9), 24));
arithOne("div", 5, 3, "חִלּוּק", P_DIV, pick(divPool(range(6, 12), 12), 24));
wordSets(5, 3, [
  { p: "מְכוֹנִית נוֹסַעַת 60 קילוֹמֶטֶר בְּשָׁעָה. כַּמָּה תִּסַּע בְּ-3 שָׁעוֹת?", a: 180, d: [63, 120, 20] },
  { p: "בְּחֲנוּת 250 בַּקְבּוּקִים, מָכְרוּ 175. כַּמָּה נִשְׁאֲרוּ?", a: 75, d: [125, 85, 425] },
  { p: "7 קֻפְסָאוֹת שֶׁל 8 עֵטִים. כַּמָּה עֵטִים?", a: 56, d: [15, 48, 64] },
], 1);

// ===================== GRADE 6 =====================
mcOne("ops", 6, 3, ...T_OPS, opsPool([[6, 12, 3, 1], [20, 4, 3, 2], [5, 6, 4, 0], [40, 5, 6, 2], [4, 7, 3, 3], [10, 3, 5, 0], [8, 4, 2, 1], [30, 2, 7, 2]]));
mcOne("frac", 6, 3, "חִבּוּר שְׁבָרִים", "כַּמָּה זֶה?", [
  { glyph: "1/4 + 1/4", correct: "1/2", distractors: ["2/8", "1/8", "2/4"] },
  { glyph: "1/3 + 1/3", correct: "2/3", distractors: ["2/6", "1/6", "1/3"] },
  { glyph: "1/2 + 1/4", correct: "3/4", distractors: ["2/6", "1/8", "2/4"] },
  { glyph: "1/5 + 2/5", correct: "3/5", distractors: ["3/10", "1/5", "2/5"] },
]);
mcOne("frac-cmp", 6, 3, "הַשְׁווּ שְׁבָרִים", "אֵיזֶה שֶׁבֶר גָּדוֹל יוֹתֵר?", [
  { glyph: "3/4 ? 2/3", correct: "3/4", distractors: ["2/3"] },
  { glyph: "5/6 ? 2/3", correct: "5/6", distractors: ["2/3"] },
  { glyph: "2/5 ? 1/2", correct: "1/2", distractors: ["2/5"] },
  { glyph: "7/8 ? 3/4", correct: "7/8", distractors: ["3/4"] },
]);
mcOne("dec", 6, 3, "כֶּפֶל עֶשְׂרוֹנִי", "כַּמָּה זֶה?", [
  { glyph: "0.2 × 3", correct: "0.6", distractors: ["0.5", "6", "0.23"] },
  { glyph: "0.5 × 4", correct: "2", distractors: ["0.20", "20", "2.5"] },
  { glyph: "2.5 - 0.5", correct: "2", distractors: ["2.5", "3", "1.5"] },
  { glyph: "0.1 × 10", correct: "1", distractors: ["0.10", "10", "0.1"] },
]);
mcOne("unknown", 6, 3, "מַהוּ הַנֶּעְלָם?", "אֵיזֶה מִסְפָּר מַשְׁלִים אֶת הַתַּרְגִּיל?", [
  { glyph: "? + 7 = 15", correct: 8, distractors: [22, 7, 9] },
  { glyph: "? - 5 = 12", correct: 17, distractors: [7, 60, 18] },
  { glyph: "3 × ? = 21", correct: 7, distractors: [18, 24, 63] },
  { glyph: "? / 4 = 6", correct: 24, distractors: [10, 2, 12] },
]);

console.log(`generated ${total} math lessons (${problems} arithmetic problems, ${questions} concept questions) into ${OUT}`);
