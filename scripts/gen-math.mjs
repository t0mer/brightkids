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
  n = Math.min(n, Math.floor((max * (max - 1)) / 2)); // never loop past the distinct-pair count
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
    let ds = [...new Set([ltr, ans + 1, ans - 1, ans + 2].filter((x) => x !== ans && x >= 0))];
    if (ds.length < 2) ds = near(ans, 3, { min: 0 });
    return { glyph, correct: ans, distractors: ds.slice(0, 3) };
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

// ---------- bigger procedural pools (up to ~50 exercises per lesson) ----------
const N_ARITH = 74; // 24 originals + up to 50 more, capped by each pool's natural size
const TWO_DIGIT = range(10, 99);
const THREE_DIGIT = range(100, 999);
const multiples = (m, count) => range(1, count).map((i) => i * m);

// n distinct "<,>,=" pairs within [1,max]
function signPairs(n, max) {
  const seen = new Set(); const out = []; let g = 0;
  while (out.length < n && g++ < n * 60) {
    const a = 1 + Math.floor(rand() * max), b = 1 + Math.floor(rand() * max);
    const k = `${a},${b}`; if (seen.has(k)) continue; seen.add(k); out.push([a, b]);
  }
  return out;
}
// n order-of-operations specs [a,b,c,type] (type 2 "a - b×c" kept non-negative)
function opsSpecs(n, aMax, bMax, cMax) {
  const seen = new Set(); const out = []; let g = 0;
  while (out.length < n && g++ < n * 60) {
    const type = Math.floor(rand() * 4);
    let a = 1 + Math.floor(rand() * aMax);
    const b = 1 + Math.floor(rand() * bMax), c = 1 + Math.floor(rand() * cMax);
    if (type === 2) a = b * c + 1 + Math.floor(rand() * 9);
    const k = `${a},${b},${c},${type}`; if (seen.has(k)) continue; seen.add(k); out.push([a, b, c, type]);
  }
  return out;
}
// compare-fractions pool
const FRACS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8]];
function fracCmpPool(n) {
  const out = []; const seen = new Set(); let g = 0;
  while (out.length < n && g++ < n * 80) {
    const [pa, pb] = FRACS[Math.floor(rand() * FRACS.length)];
    const [qa, qb] = FRACS[Math.floor(rand() * FRACS.length)];
    const va = pa / pb, vq = qa / qb; if (va === vq) continue;
    const s1 = `${pa}/${pb}`, s2 = `${qa}/${qb}`;
    const k = [s1, s2].sort().join("|"); if (seen.has(k)) continue; seen.add(k);
    out.push({ glyph: `${s1} ? ${s2}`, correct: va > vq ? s1 : s2, distractors: [va > vq ? s2 : s1] });
  }
  return out;
}
const decFmt = (t) => (t % 10 === 0 ? String(t / 10) : (t / 10).toFixed(1));
// decimal +/- pool (one decimal place), exact via integer (tenths) math
function decPool(n, op) {
  const out = []; const seen = new Set(); let g = 0;
  while (out.length < n && g++ < n * 60) {
    let a = 1 + Math.floor(rand() * 50), b = 1 + Math.floor(rand() * 50);
    if (op === "-" && b > a) [a, b] = [b, a];
    const res = op === "+" ? a + b : a - b;
    const glyph = `${decFmt(a)} ${op} ${decFmt(b)}`;
    if (seen.has(glyph)) continue; seen.add(glyph);
    let ds = [...new Set([res + 10, res - 10, res + 1, res + 2].filter((x) => x > 0 && x !== res))].slice(0, 3);
    if (ds.length < 2) ds = [res + 10, res + 20];
    out.push({ glyph, correct: decFmt(res), distractors: ds.map(decFmt) });
  }
  return out;
}
// decimal × integer pool (tenths × small int)
function decMulPool(n) {
  const out = []; const seen = new Set(); let g = 0;
  while (out.length < n && g++ < n * 60) {
    const a = 1 + Math.floor(rand() * 9), b = 2 + Math.floor(rand() * 8);
    const res = a * b;
    const glyph = `${(a / 10).toFixed(1)} × ${b}`;
    if (seen.has(glyph)) continue; seen.add(glyph);
    let ds = [...new Set([res + 10, res - 10, res + 2].filter((x) => x > 0 && x !== res))].slice(0, 3);
    if (ds.length < 2) ds = [res + 10, res + 20];
    out.push({ glyph, correct: decFmt(res), distractors: ds.map(decFmt) });
  }
  return out;
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function fracStr(n, d) { const g = gcd(n, d) || 1; n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; }
// fraction addition with equal denominators (sum <= 1) -> simplified result
function fracAddPool(n) {
  const out = []; const seen = new Set(); let g = 0;
  while (out.length < n && g++ < n * 80) {
    const d = [2, 3, 4, 5, 6, 8][Math.floor(rand() * 6)];
    const a = 1 + Math.floor(rand() * (d - 1)), b = 1 + Math.floor(rand() * (d - 1));
    if (a + b > d) continue;
    const glyph = `${a}/${d} + ${b}/${d}`; if (seen.has(glyph)) continue; seen.add(glyph);
    const correct = fracStr(a + b, d);
    const ds = [...new Set([`${a + b}/${d * 2}`, `${a + b}/${d}`, fracStr(a + b + 1, d)])].filter((x) => x !== correct).slice(0, 3);
    out.push({ glyph, correct, distractors: ds.length ? ds : [`${a + b}/${d * 2}`, `${a}/${d}`] });
  }
  return out;
}
// missing-number pool (?+b=c, ?-b=c, b×?=c, ?/b=c)
function unknownPool(n, max) {
  const out = []; const seen = new Set(); let g = 0;
  while (out.length < n && g++ < n * 60) {
    const t = Math.floor(rand() * 4); let glyph, ans;
    if (t === 0) { const b = 1 + Math.floor(rand() * max), s = b + 1 + Math.floor(rand() * max); glyph = `? + ${b} = ${s}`; ans = s - b; }
    else if (t === 1) { const b = 1 + Math.floor(rand() * max), x = b + 1 + Math.floor(rand() * max); glyph = `? - ${b} = ${x - b}`; ans = x; }
    else if (t === 2) { const b = 2 + Math.floor(rand() * 9), q = 2 + Math.floor(rand() * 9); glyph = `${b} × ? = ${b * q}`; ans = q; }
    else { const b = 2 + Math.floor(rand() * 9), q = 2 + Math.floor(rand() * 9); glyph = `? / ${b} = ${q}`; ans = b * q; }
    if (seen.has(glyph)) continue; seen.add(glyph);
    out.push({ glyph, correct: ans, distractors: near(ans, 3, { min: 0, max: ans + 12 }) });
  }
  return out;
}
// templated word problems -> n grade-appropriate {p,a,d}
const W_NOUN = ["תַּפּוּחִים", "בָּלוֹנִים", "עוּגִיּוֹת", "כַּדּוּרִים", "עֵטִים", "סְפָרִים", "פְּרָחִים", "סֻכָּרִיּוֹת", "מַדְבֵּקוֹת", "צִיּוּרִים"];
const W_SCENE = ["בַּסַּל", "בַּקֻּפְסָה", "עַל הַשֻּׁלְחָן", "בַּגִּנָּה", "בַּכִּתָּה", "בַּחֲנוּת"];
const wPick = (arr) => arr[Math.floor(rand() * arr.length)];
function wordPool(n, ops, lo, hi) {
  const out = []; const seen = new Set(); let g = 0;
  while (out.length < n && g++ < n * 80) {
    const op = ops[Math.floor(rand() * ops.length)];
    const noun = wPick(W_NOUN), scene = wPick(W_SCENE); let p, a;
    if (op === "+") {
      const A = lo + Math.floor(rand() * (hi - lo)), B = lo + Math.floor(rand() * (hi - lo));
      p = `${scene} הָיוּ ${A} ${noun} וְהוֹסִיפוּ עוֹד ${B}. כַּמָּה ${noun} יֵשׁ עַכְשָׁיו?`; a = A + B;
    } else if (op === "-") {
      const A = lo + 2 + Math.floor(rand() * (hi - lo)), B = 1 + Math.floor(rand() * (A - 1));
      p = `${scene} הָיוּ ${A} ${noun} וְלָקְחוּ ${B}. כַּמָּה ${noun} נִשְׁאֲרוּ?`; a = A - B;
    } else if (op === "x") {
      const A = 2 + Math.floor(rand() * 8), B = 2 + Math.floor(rand() * 8);
      p = `בְּכָל קֻפְסָה ${B} ${noun} וְיֵשׁ ${A} קֻפְסָאוֹת. כַּמָּה ${noun} בְּסַךְ הַכֹּל?`; a = A * B;
    } else {
      const B = 2 + Math.floor(rand() * 6), q = 2 + Math.floor(rand() * 8), P = B * q;
      p = `חִלְּקוּ ${P} ${noun} שָׁוֶה בֵּין ${B} יְלָדִים. כַּמָּה קִבֵּל כָּל אֶחָד?`; a = q;
    }
    if (seen.has(p)) continue; seen.add(p);
    out.push({ p, a, d: near(a, 3, { min: 0, max: a + 15 }) });
  }
  return out;
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
mcOne("even", 1, 2, ...T_EVEN, evenOddPool(1, 40));
mcOne("succ", 1, 1, ...T_SUCC, succPool(1, 60));
mcOne("pred", 1, 1, ...T_PRED, predPool(2, 60));
mcOne("seq", 1, 2, ...T_SEQ, seqPool([2, 3, 5, 10], range(1, 12), 90));
mcOne("num", 1, 1, ...T_NUM, numRecPool(1, 50));
mcOne("clock", 1, 2, ...T_CLOCK, clockPool(range(1, 12)));
cmpOne(1, 1, 74, 25);
arithOne("add", 1, 1, "חִבּוּר עַד 10", P_ADD, pick(addPool(1, 9, 10), 74));
arithOne("sub", 1, 1, "חִסּוּר עַד 10", P_SUB, pick(subPool(2, 10), 74));
wordSets(1, 2, wordPool(28, ["+", "-"], 2, 12));

// ===================== GRADE 2 =====================
mcOne("place-tens", 2, 2, "כַּמָּה עֲשָׂרוֹת?", "כַּמָּה עֲשָׂרוֹת יֵשׁ בַּמִּסְפָּר?", tensPool(pick(TWO_DIGIT, 50)));
mcOne("place-units", 2, 2, "כַּמָּה יְחִידוֹת?", "כַּמָּה יְחִידוֹת יֵשׁ בַּמִּסְפָּר?", unitsPool(pick(TWO_DIGIT, 50)));
mcOne("even", 2, 2, ...T_EVEN, evenOddPool(10, 70));
mcOne("seq", 2, 2, ...T_SEQ, seqPool([3, 5, 10], range(10, 30), 200));
mcOne("sign", 2, 2, "אֵיזֶה סִימָן מַתְאִים?", "אֵיזֶה סִימָן מַתְאִים בֵּין הַמִּסְפָּרִים?", signPool(signPairs(50, 30)));
mcOne("half", 2, 2, "חֲצִי", "כַּמָּה זֶה חֲצִי?", fracPool(multiples(2, 30), 2, "½"));
arithOne("add20", 2, 2, "חִבּוּר עַד 20", P_ADD, pick(addPool(2, 19, 20), 74));
arithOne("add100", 2, 2, "חִבּוּר עַד 100", P_ADD, pick(addRange(10, 89), 74));
arithOne("sub20", 2, 2, "חִסּוּר עַד 20", P_SUB, pick(subPool(11, 20), 74));
arithOne("sub100", 2, 2, "חִסּוּר עַד 100", P_SUB, pick(subPool(20, 99, 7, 5), 74));
arithOne("mul", 2, 2, "כֶּפֶל בְּ-2, 5, 10", P_MUL, pick(mulPool([2, 5, 10], 10), 74));
cmpOne(2, 2, 74, 50);
wordSets(2, 2, wordPool(30, ["+", "-", "x"], 3, 20));

// ===================== GRADE 3 =====================
mcOne("ops", 3, 3, ...T_OPS, opsPool(opsSpecs(50, 12, 6, 6)));
mcOne("seq", 3, 2, ...T_SEQ, seqPool([3, 4, 6, 7], range(3, 16), 140));
mcOne("round-tens", 3, 3, "עִגּוּל לַעֲשָׂרוֹת", "עַגְּלוּ אֶת הַמִּסְפָּר לָעֲשָׂרוֹת", roundPool(pick(TWO_DIGIT, 50), 10));
mcOne("half", 3, 2, "חֲצִי", "כַּמָּה זֶה חֲצִי?", fracPool(multiples(2, 40), 2, "½"));
mcOne("quarter", 3, 2, "רֶבַע", "כַּמָּה זֶה רֶבַע?", fracPool(multiples(4, 30), 4, "¼"));
mcOne("clock", 3, 2, ...T_CLOCK, clockPool(range(1, 12)));
arithOne("mul", 3, 2, "לוּחַ הַכֶּפֶל", P_MUL, pick(mulPool([3, 4, 6, 7, 8, 9], 10), 74));
arithOne("div", 3, 2, "חִלּוּק", P_DIV, pick(divPool([2, 3, 4, 5, 6, 7, 8, 10], 10), 74));
arithOne("add", 3, 2, "חִבּוּר תְּלַת־סִפְרָתִי", P_ADD, pick(addRange(100, 899), 74));
arithOne("sub", 3, 2, "חִסּוּר דּוּ־סִפְרָתִי", P_SUB, pick(subPool(30, 99, 5, 7), 74));
wordSets(3, 3, wordPool(30, ["x", "/", "+", "-"], 5, 30));

// ===================== GRADE 4 =====================
mcOne("ops", 4, 3, ...T_OPS, opsPool(opsSpecs(50, 20, 9, 6)));
mcOne("round-hundreds", 4, 3, "עִגּוּל לַמֵּאוֹת", "עַגְּלוּ אֶת הַמִּסְפָּר לַמֵּאוֹת", roundPool(pick(THREE_DIGIT, 50), 100));
mcOne("quarter", 4, 3, "רֶבַע", "כַּמָּה זֶה רֶבַע?", fracPool(multiples(4, 30), 4, "¼"));
mcOne("third", 4, 3, "שְׁלִישׁ", "כַּמָּה זֶה שְׁלִישׁ?", fracPool(multiples(3, 30), 3, "⅓"));
arithOne("mul", 4, 3, "כֶּפֶל עַד 12", P_MUL, pick(mulPool(range(2, 12), 12), 74));
arithOne("div", 4, 3, "חִלּוּק עַד 12", P_DIV, pick(divPool(range(2, 12), 12), 74));
arithOne("add", 4, 3, "חִבּוּר תְּלַת־סִפְרָתִי", P_ADD, pick(addRange(100, 899), 74));
wordSets(4, 3, wordPool(30, ["x", "/", "-", "+"], 10, 50));

// ===================== GRADE 5 =====================
mcOne("ops", 5, 3, ...T_OPS, opsPool(opsSpecs(50, 30, 9, 7)));
mcOne("half", 5, 3, "חֲצִי", "כַּמָּה זֶה חֲצִי?", fracPool(multiples(2, 40), 2, "½"));
mcOne("frac-cmp", 5, 3, "הַשְׁווּ שְׁבָרִים", "אֵיזֶה שֶׁבֶר גָּדוֹל יוֹתֵר?", fracCmpPool(40));
mcOne("dec", 5, 3, "שְׁבָרִים עֶשְׂרוֹנִיִּים", "כַּמָּה זֶה?", [...decPool(25, "+"), ...decPool(25, "-")]);
arithOne("mul", 5, 3, "כֶּפֶל גָּדוֹל", P_MUL, pick(mulPool(range(11, 20), 9), 74));
arithOne("div", 5, 3, "חִלּוּק", P_DIV, pick(divPool(range(6, 12), 12), 74));
wordSets(5, 3, wordPool(28, ["x", "/", "-", "+"], 10, 80));

// ===================== GRADE 6 =====================
mcOne("ops", 6, 3, ...T_OPS, opsPool(opsSpecs(50, 40, 12, 7)));
mcOne("frac", 6, 3, "חִבּוּר שְׁבָרִים", "כַּמָּה זֶה?", fracAddPool(40));
mcOne("frac-cmp", 6, 3, "הַשְׁווּ שְׁבָרִים", "אֵיזֶה שֶׁבֶר גָּדוֹל יוֹתֵר?", fracCmpPool(40));
mcOne("dec", 6, 3, "כֶּפֶל עֶשְׂרוֹנִי", "כַּמָּה זֶה?", decMulPool(40));
mcOne("unknown", 6, 3, "מַהוּ הַנֶּעְלָם?", "אֵיזֶה מִסְפָּר מַשְׁלִים אֶת הַתַּרְגִּיל?", unknownPool(40, 20));

console.log(`generated ${total} math lessons (${problems} arithmetic problems, ${questions} concept questions) into ${OUT}`);
