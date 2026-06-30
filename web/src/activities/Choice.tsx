import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Item, Question } from "@/lib/types";
import type { ActivityProps } from "./types";
import { shuffle, cn } from "@/lib/utils";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { useStore } from "@/store/useStore";

// Choice powers "letter-recognition" and "multiple-choice". A lesson may carry a
// single `items` set or a `questions` set (3-5 questions from the same category);
// the set is presented in a randomized order, one question at a time, with a
// progress bar. Exactly one item per question is correct.
export function Choice({ lesson, locale, onCorrect, onWrong, solved, onPrompt }: ActivityProps) {
  const voiceEnabled = useStore((s) => s.settings?.voice_enabled ?? true);

  // Normalize to a list of questions, shuffled for display. A single-items lesson
  // becomes a one-question set.
  const questions = useMemo<Question[]>(() => {
    const qs =
      lesson.questions && lesson.questions.length > 0
        ? lesson.questions
        : [{ glyph: lesson.glyph, items: lesson.items ?? [] }];
    return shuffle(qs);
  }, [lesson.id]);

  const [index, setIndex] = useState(0);
  const [wrongId, setWrongId] = useState<string | null>(null);

  const q = questions[index];
  // Each question's options are shuffled too.
  const items = useMemo(() => shuffle(q?.items ?? []), [lesson.id, index]);

  const isLast = index === questions.length - 1;
  const showProgress = questions.length > 1;

  // Report this question's instruction up to the LessonPlayer (text + spoken).
  useEffect(() => {
    if (!q || !onPrompt) return;
    const tts = q.prompt || lesson.prompt_tts;
    const text = q.prompt_text || q.prompt || lesson.instruction || lesson.prompt_tts;
    onPrompt({ text, tts });
  }, [index, q, onPrompt, lesson]);

  function choose(item: Item) {
    if (solved) return;
    if (item.tts || item.label) {
      speak(item.tts || item.label || "", { locale, enabled: voiceEnabled });
    }
    if (item.correct) {
      if (isLast) {
        play("ding");
        onCorrect(lesson.reward.stars);
      } else {
        play("pop");
        setIndex((i) => i + 1);
      }
    } else {
      play("wrong");
      setWrongId(item.id);
      onWrong();
      window.setTimeout(() => setWrongId(null), 600);
    }
  }

  if (!q) return null;

  const hasWords = items.some((i) => !i.emoji && (i.label?.length ?? 0) > 2);
  const textSize = hasWords ? "text-2xl sm:text-3xl" : "text-6xl sm:text-7xl";

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {showProgress && (
        <div className="flex w-full max-w-xs flex-col gap-1">
          <span className="ltr-num text-center text-sm text-cream/70">
            {index + (solved ? 1 : 0)} / {questions.length}
          </span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-mint transition-all"
              style={{ width: `${((index + (solved ? 1 : 0)) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Optional visible prompt: a number, sequence, or expression (LTR). */}
      {q.glyph && (
        <div className="ltr-num rounded-blob bg-white/95 px-8 py-5 font-display text-5xl text-ink shadow-tile dark:bg-nebula dark:text-cream">
          {q.glyph}
        </div>
      )}

      <div dir={lesson.direction} className="grid w-full grid-cols-2 gap-4">
        {items.map((item) => (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.94 }}
            animate={wrongId === item.id ? { x: [0, -8, 8, -6, 0] } : {}}
            onClick={() => choose(item)}
            disabled={solved}
            className={cn(
              "tap flex min-h-[7rem] items-center justify-center rounded-blob bg-white/95 p-4 text-center text-ink shadow-tile transition-transform",
              "dark:bg-nebula dark:text-cream",
              textSize,
              item.correct && solved && "ring-4 ring-mint",
            )}
          >
            {item.emoji ? (
              <span className="text-6xl sm:text-7xl">{item.emoji}</span>
            ) : (
              <span className="font-display leading-tight break-words">{item.label}</span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
