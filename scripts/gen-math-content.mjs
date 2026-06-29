// Generates math practice-set lessons (arithmetic problem sets) for BrightKids.
// Deterministic (seeded) so re-runs don't churn the content. Each lesson is a
// set of problems the Arithmetic activity steps through. Output: content/math/.
//
//   node scripts/gen-math-content.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../content/math");
mkdirSync(OUT, { recursive: true });

const PER_SET = 12; // problems per lesson

// Seeded RNG (mulberry32) for a stable shuffle across runs.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A category produces a candidate pool of {operands, operator, answer}.
// Instructions and titles are in Hebrew (the app's primary language); equations
// themselves render LTR. `prompt` is the spoken Hebrew instruction.
const categories = [
  {
    key: "add",
    prompt: "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִבּוּר",
    op: "+",
    grades: {
      1: { difficulty: 1, sets: 3, title: "חִבּוּר עַד 10", pool: addPool(1, 9, 10) },
      2: { difficulty: 2, sets: 3, title: "חִבּוּר עַד 20", pool: addPool(2, 19, 20) },
      3: { difficulty: 2, sets: 2, title: "חִבּוּר דּוּ־סִפְרָתִי", pool: addRange(10, 89, 99) },
      4: { difficulty: 3, sets: 2, title: "חִבּוּר תְּלַת־סִפְרָתִי", pool: addRange(100, 899, 999) },
    },
  },
  {
    key: "sub",
    prompt: "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִסּוּר",
    op: "-",
    grades: {
      1: { difficulty: 1, sets: 3, title: "חִסּוּר עַד 10", pool: subPool(2, 10) },
      2: { difficulty: 2, sets: 3, title: "חִסּוּר עַד 20", pool: subPool(11, 20) },
      3: { difficulty: 2, sets: 2, title: "חִסּוּר דּוּ־סִפְרָתִי", pool: subPool(20, 99) },
      4: { difficulty: 3, sets: 2, title: "חִסּוּר תְּלַת־סִפְרָתִי", pool: subPool(100, 999) },
    },
  },
  {
    key: "mul",
    prompt: "פִּתְרוּ אֶת תַּרְגִּילֵי הַכֶּפֶל",
    op: "x",
    grades: {
      3: { difficulty: 2, sets: 3, title: "לוּחַ הַכֶּפֶל (2, 5, 10)", pool: mulPool([2, 5, 10], 10) },
      4: { difficulty: 3, sets: 3, title: "לוּחַ הַכֶּפֶל עַד 12", pool: mulPool(range(2, 12), 12) },
    },
  },
  {
    key: "div",
    prompt: "פִּתְרוּ אֶת תַּרְגִּילֵי הַחִלּוּק",
    op: "/",
    grades: {
      3: { difficulty: 2, sets: 2, title: "חִלּוּק (2, 5, 10)", pool: divPool([2, 5, 10], 10) },
      4: { difficulty: 3, sets: 2, title: "חִלּוּק עַד 12", pool: divPool(range(2, 12), 12) },
    },
  },
];

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// Addition where both addends are >= lo and the sum is <= maxSum.
function addPool(lo, hi, maxSum) {
  const out = [];
  for (let a = lo; a <= hi; a++)
    for (let b = lo; b <= hi; b++)
      if (a + b <= maxSum && a >= 1 && b >= 1)
        out.push({ operands: [a, b], operator: "+", answer: a + b });
  return out;
}
// Addition with both addends in [lo, hi] (no sum cap beyond hi*2).
function addRange(lo, hi, maxOperand) {
  const out = [];
  for (let a = lo; a <= maxOperand; a += 7)
    for (let b = lo; b <= maxOperand; b += 11)
      out.push({ operands: [a, b], operator: "+", answer: a + b });
  return out;
}
// Subtraction a - b with a in [lo, hi], 1 <= b < a (answer >= 1).
function subPool(lo, hi) {
  const out = [];
  const stepA = hi - lo > 80 ? 7 : 1;
  for (let a = lo; a <= hi; a += stepA)
    for (let b = 1; b < a; b += hi - lo > 80 ? 5 : 1)
      out.push({ operands: [a, b], operator: "-", answer: a - b });
  return out;
}
// Multiplication tables[] x 1..maxB.
function mulPool(tables, maxB) {
  const out = [];
  for (const a of tables)
    for (let b = 1; b <= maxB; b++) out.push({ operands: [a, b], operator: "x", answer: a * b });
  return out;
}
// Division: dividend = a*b, divide by b to get a (whole-number answers).
function divPool(divisors, maxQuotient) {
  const out = [];
  for (const b of divisors)
    for (let a = 1; a <= maxQuotient; a++)
      out.push({ operands: [a * b, b], operator: "/", answer: a });
  return out;
}

function yamlProblem(p) {
  return `  - { operands: [${p.operands.join(", ")}], operator: "${p.operator}", answer: ${p.answer} }`;
}

const pad = (n) => String(n).padStart(2, "0");
let files = 0;
let problems = 0;
let seed = 1;

for (const cat of categories) {
  for (const [gradeStr, spec] of Object.entries(cat.grades)) {
    const grade = Number(gradeStr);
    // Dedupe the pool by equation, then shuffle once and chunk into sets so no
    // problem repeats across that grade's sets.
    const seen = new Set();
    const unique = spec.pool.filter((p) => {
      const k = `${p.operands.join(",")}${p.operator}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const shuffled = shuffle(unique, rng(seed++));

    for (let s = 0; s < spec.sets; s++) {
      const chunk = shuffled.slice(s * PER_SET, s * PER_SET + PER_SET);
      if (chunk.length < PER_SET) {
        // Not enough unique problems — top up from the start (rare; small pools).
        chunk.push(...shuffled.slice(0, PER_SET - chunk.length));
      }
      const id = `math-g${grade}-${cat.key}-set-${pad(s + 1)}`;
      const title = `${spec.title} — סֵט ${s + 1}`;
      const body = [
        `id: ${id}`,
        `subject: math`,
        `grade: ${grade}`,
        `difficulty: ${spec.difficulty}`,
        `locale: he-IL`,
        `direction: ltr`,
        `title: "${title}"`,
        `activity: arithmetic`,
        `prompt_tts: "${cat.prompt}"`,
        `problems:`,
        ...chunk.map(yamlProblem),
        `reward: { stars: 3, sfx: ding, effect: confetti }`,
        ``,
      ].join("\n");
      writeFileSync(resolve(OUT, `${id}.yaml`), body);
      files++;
      problems += chunk.length;
    }
  }
}

console.log(`generated ${files} lessons, ${problems} problems into ${OUT}`);
