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
