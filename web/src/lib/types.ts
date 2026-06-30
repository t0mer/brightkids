// Mirrors the Go JSON shapes served by /api/v1.

export type Subject = "hebrew" | "english" | "math";
export type Direction = "rtl" | "ltr";

export type Activity =
  | "letter-recognition"
  | "tracing"
  | "matching"
  | "multiple-choice"
  | "counting"
  | "arithmetic"
  | "drag-drop"
  | "comparison";

export interface SubjectSummary {
  subject: Subject;
  grades: number[];
}

export interface LessonSummary {
  id: string;
  subject: Subject;
  grade: number;
  difficulty: number;
  title: string;
  activity: Activity;
  direction: Direction;
  locale: string;
}

export interface Item {
  id: string;
  label?: string;
  correct?: boolean;
  tts?: string;
  audio?: string;
  emoji?: string;
  image?: string;
}

export interface Pair {
  id: string;
  left: string;
  right?: string;
  left_tts?: string;
  right_tts?: string;
  emoji?: string;
}

export interface Problem {
  operands?: number[];
  operator: string;
  answer: number;
}

export interface Comparison {
  left: number;
  right: number;
}

export interface Question {
  /** Per-question spoken+shown Hebrew instruction (overrides the lesson prompt). */
  prompt?: string;
  /** On-screen text override when it must differ from what is spoken. */
  prompt_text?: string;
  /** Visible expression (number, sequence, equation). */
  glyph?: string;
  items: Item[];
}

export interface Reward {
  stars: number;
  sfx: string;
  effect: string;
}

export interface Lesson {
  id: string;
  subject: Subject;
  grade: number;
  difficulty: number;
  locale: string;
  direction: Direction;
  title: string;
  activity: Activity;
  prompt_tts: string;
  /** On-screen instruction text, always Hebrew. Falls back to prompt_tts. */
  instruction?: string;
  audio?: string;
  items?: Item[];
  pairs?: Pair[];
  problem?: Problem;
  problems?: Problem[];
  comparisons?: Comparison[];
  questions?: Question[];
  glyph?: string;
  solution?: string[];
  reward: Reward;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  locale_pref: string;
  created_at: string;
}

export interface Settings {
  profile_id: string;
  sound_enabled: boolean;
  voice_enabled: boolean;
  reduce_motion: boolean;
  dyslexia_font: boolean;
  ui_lang: string;
}

export interface LessonProgress {
  lesson_id: string;
  subject: Subject;
  grade: number;
  stars: number;
  attempts: number;
  completed_at: string;
}

export interface ProgressSummary {
  profile_id: string;
  total_stars: number;
  streak: number;
  lessons: LessonProgress[];
  completed_by_subject: Record<string, number>;
}
