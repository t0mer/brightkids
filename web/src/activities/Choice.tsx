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

  const big = items.length <= 4;

  return (
    <div
      dir={lesson.direction}
      className={cn(
        "grid w-full gap-4",
        items.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-2",
      )}
    >
      {items.map((item) => (
        <motion.button
          key={item.id}
          whileTap={{ scale: 0.94 }}
          animate={wrongId === item.id ? { x: [0, -8, 8, -6, 0] } : {}}
          onClick={() => choose(item)}
          disabled={solved}
          className={cn(
            "tap flex min-h-[7rem] items-center justify-center rounded-blob bg-white/95 p-4 text-ink shadow-tile transition-transform",
            "dark:bg-nebula dark:text-cream",
            big ? "text-6xl sm:text-7xl" : "text-4xl",
            item.correct && solved && "ring-4 ring-mint",
          )}
        >
          {item.emoji ? (
            <span className="text-6xl sm:text-7xl">{item.emoji}</span>
          ) : (
            <span className="font-display">{item.label}</span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
