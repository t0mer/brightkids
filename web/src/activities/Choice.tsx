import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Item } from "@/lib/types";
import type { ActivityProps } from "./types";
import { shuffle, cn } from "@/lib/utils";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { useStore } from "@/store/useStore";

// Choice powers both "letter-recognition" (pick the letter you hear) and
// "multiple-choice" (listen/read, pick one). Exactly one item is correct.
export function Choice({ lesson, locale, onCorrect, onWrong, solved }: ActivityProps) {
  const items = useMemo(() => shuffle(lesson.items ?? []), [lesson.id]);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const voiceEnabled = useStore((s) => s.settings?.voice_enabled ?? true);

  function choose(item: Item) {
    if (solved) return;
    if (item.tts || item.label) {
      speak(item.tts || item.label || "", { locale, enabled: voiceEnabled });
    }
    if (item.correct) {
      play("ding");
      onCorrect(lesson.reward.stars);
    } else {
      play("wrong");
      setWrongId(item.id);
      onWrong();
      window.setTimeout(() => setWrongId(null), 600);
    }
  }

  // Single glyphs (letters/digits) get the big playful size; multi-character
  // word labels scale down and wrap so they never clip — important for the wider
  // OpenDyslexic glyphs too.
  const hasWords = items.some((i) => !i.emoji && (i.label?.length ?? 0) > 2);
  const textSize = hasWords ? "text-2xl sm:text-3xl" : "text-6xl sm:text-7xl";

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Optional visible prompt (a number, sequence, or expression). Always LTR
          so math reads correctly even inside an RTL screen. */}
      {lesson.glyph && (
        <div className="ltr-num rounded-blob bg-white/95 px-8 py-5 font-display text-5xl text-ink shadow-tile dark:bg-nebula dark:text-cream">
          {lesson.glyph}
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
