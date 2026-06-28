import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ActivityProps } from "./types";
import { cn, shuffle } from "@/lib/utils";
import { play } from "@/lib/sfx";

// Counting renders N objects the child taps to count, then picks the total from
// a numeric keypad of choices. Tapping each object gives playful feedback.
export function Counting({ lesson, onCorrect, onWrong, solved }: ActivityProps) {
  const target = lesson.problem?.answer ?? 0;
  const glyph = lesson.glyph ?? "⭐";
  const [tapped, setTapped] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);

  // Numeric options around the target (e.g. target±, deduped, 1..9).
  const options = useMemo(() => {
    const set = new Set<number>([target]);
    let n = Math.max(1, target - 2);
    while (set.size < 4 && n <= target + 3) {
      if (n >= 1) set.add(n);
      n++;
    }
    return shuffle([...set]);
  }, [lesson.id, target]);

  function pick(n: number) {
    if (solved) return;
    if (n === target) {
      play("ding");
      onCorrect(lesson.reward.stars);
    } else {
      play("wrong");
      setWrong(n);
      onWrong();
      window.setTimeout(() => setWrong(null), 600);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex max-w-md flex-wrap justify-center gap-3">
        {Array.from({ length: target }).map((_, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 1.3 }}
            onClick={() => {
              play("pop");
              setTapped((prev) => new Set(prev).add(i));
            }}
            className={cn(
              "tap grid h-16 w-16 place-items-center rounded-2xl text-4xl transition-colors",
              tapped.has(i) ? "bg-mint/30 ring-2 ring-mint" : "bg-white/10",
            )}
            aria-label={`object ${i + 1}`}
          >
            {glyph}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {options.map((n) => (
          <motion.button
            key={n}
            whileTap={{ scale: 0.94 }}
            animate={wrong === n ? { x: [0, -8, 8, -6, 0] } : {}}
            onClick={() => pick(n)}
            disabled={solved}
            className={cn(
              "tap ltr-num grid h-20 w-20 place-items-center rounded-blob bg-white/95 font-display text-4xl text-ink shadow-tile dark:bg-nebula dark:text-cream",
              n === target && solved && "ring-4 ring-mint",
            )}
          >
            {n}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
