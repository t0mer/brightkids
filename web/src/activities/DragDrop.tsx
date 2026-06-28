import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Item } from "@/lib/types";
import type { ActivityProps } from "./types";
import { cn, shuffle } from "@/lib/utils";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { useStore } from "@/store/useStore";

// DragDrop: arrange tokens into the correct order. Implemented as tap-to-build
// (tap a token to place it in the next slot, tap a placed token to return it) —
// far more reliable than HTML5 drag on small touch devices.
export function DragDrop({ lesson, locale, onCorrect, onWrong, solved }: ActivityProps) {
  const items = lesson.items ?? [];
  const solution = lesson.solution ?? [];
  const voiceEnabled = useStore((s) => s.settings?.voice_enabled ?? true);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [lesson.id]);

  const pool = useMemo(() => shuffle(items), [lesson.id]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  const available = pool.filter((i) => !placed.includes(i.id));

  function token(item: Item, onClick: () => void, placedTile = false) {
    return (
      <motion.button
        key={item.id}
        layout
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        disabled={solved}
        className={cn(
          "tap flex min-h-[4rem] min-w-[4rem] items-center justify-center rounded-blob px-4 py-3 font-display text-3xl shadow-tile",
          placedTile ? "bg-violet text-white" : "bg-white/95 text-ink dark:bg-nebula dark:text-cream",
        )}
      >
        {item.emoji ? <span className="text-4xl">{item.emoji}</span> : item.label}
      </motion.button>
    );
  }

  function place(item: Item) {
    if (solved) return;
    play("pop");
    if (item.label || item.tts) speak(item.tts || item.label || "", { locale, enabled: voiceEnabled });
    const next = [...placed, item.id];
    setPlaced(next);
    if (next.length === solution.length) check(next);
  }

  function check(next: string[]) {
    const correct = next.every((id, i) => id === solution[i]);
    if (correct) {
      play("ding");
      onCorrect(lesson.reward.stars);
    } else {
      play("wrong");
      setShake(true);
      onWrong();
      window.setTimeout(() => {
        setShake(false);
        setPlaced([]);
      }, 700);
    }
  }

  function unplace(id: string) {
    if (solved) return;
    play("tap");
    setPlaced((p) => p.filter((x) => x !== id));
  }

  return (
    <div dir={lesson.direction} className="flex w-full flex-col items-center gap-8">
      {/* Slots */}
      <motion.div
        animate={shake ? { x: [0, -10, 10, -6, 0] } : {}}
        className="flex min-h-[5rem] flex-wrap items-center justify-center gap-3 rounded-blob border-2 border-dashed border-white/25 p-4"
      >
        {placed.length === 0 && <span className="text-cream/40">…</span>}
        {placed.map((id) => {
          const item = byId.get(id);
          return item ? token(item, () => unplace(id), true) : null;
        })}
      </motion.div>

      {/* Pool */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {available.map((item) => token(item, () => place(item)))}
      </div>
    </div>
  );
}
