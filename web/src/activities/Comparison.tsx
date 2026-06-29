import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Comparison as Cmp } from "@/lib/types";
import type { ActivityProps } from "./types";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sfx";

// Comparison — the "who is bigger?" game from the original app. Two number cards;
// the child taps the larger one. Steps through a set with a progress bar and
// completes only once every pair is answered. Numbers render LTR.
export function Comparison({ lesson, onCorrect, onWrong, solved }: ActivityProps) {
  const pairs = useMemo<Cmp[]>(() => lesson.comparisons ?? [], [lesson.id]);

  const [index, setIndex] = useState(0);
  const [wrongSide, setWrongSide] = useState<"left" | "right" | null>(null);

  const pair = pairs[index];
  if (!pair) return null;

  const isLast = index === pairs.length - 1;
  const showProgress = pairs.length > 1;

  function choose(side: "left" | "right", value: number) {
    if (solved) return;
    const other = side === "left" ? pair!.right : pair!.left;
    if (value > other) {
      if (isLast) {
        play("ding");
        onCorrect(lesson.reward.stars);
      } else {
        play("pop");
        setIndex((i) => i + 1);
      }
    } else {
      play("wrong");
      setWrongSide(side);
      onWrong();
      window.setTimeout(() => setWrongSide(null), 600);
    }
  }

  function card(side: "left" | "right", value: number) {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        animate={wrongSide === side ? { x: [0, -8, 8, -6, 0] } : {}}
        onClick={() => choose(side, value)}
        disabled={solved}
        className={cn(
          "tap ltr-num flex min-h-[9rem] flex-1 items-center justify-center rounded-blob bg-white/95 font-display text-7xl text-ink shadow-tile dark:bg-nebula dark:text-cream",
        )}
        aria-label={String(value)}
      >
        {value}
      </motion.button>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {showProgress && (
        <div className="flex w-full max-w-xs flex-col gap-1">
          <span className="ltr-num text-center text-sm text-cream/70">
            {index + (solved ? 1 : 0)} / {pairs.length}
          </span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-mint transition-all"
              style={{ width: `${((index + (solved ? 1 : 0)) / pairs.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div dir="ltr" className="flex w-full items-stretch gap-4">
        {card("left", pair.left)}
        {card("right", pair.right)}
      </div>
    </div>
  );
}
