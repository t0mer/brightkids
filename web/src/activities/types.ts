import type { Lesson } from "@/lib/types";

// Every activity renderer receives the lesson plus callbacks. The activity owns
// its own interaction logic and decides when an answer is correct; the
// LessonPlayer owns the shared reward/feedback flow.
export interface ActivityProps {
  lesson: Lesson;
  /** TTS locale for this subject (he-IL / en-US). */
  locale: string;
  /** Called when the child answers correctly, with the stars earned. */
  onCorrect: (stars: number) => void;
  /** Called on a wrong attempt — triggers gentle, non-punitive feedback. */
  onWrong: () => void;
  /** True once solved, so the activity can lock further input. */
  solved: boolean;
}
