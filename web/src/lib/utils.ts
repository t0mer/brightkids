import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** cn merges class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** shuffle returns a new array in random order (Fisher–Yates). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** sample returns up to n random items from arr (shuffled). A lesson holds a
 *  large pool; each play shows a fresh random sample. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.max(1, Math.min(n, arr.length)));
}

// Stages/levels are labelled with Hebrew-letter ordinals (שלב א׳, ב׳, …).
const GRADE_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];

/** gradeLetter maps a grade number (1-based) to its Hebrew-letter label. */
export function gradeLetter(n: number): string {
  return GRADE_LETTERS[n - 1] ?? String(n);
}

/** subjectColor maps a subject to its identity Tailwind color token. */
export function subjectColor(subject: string): string {
  switch (subject) {
    case "hebrew":
      return "violet";
    case "english":
      return "mint";
    case "math":
      return "coral";
    default:
      return "violet";
  }
}
