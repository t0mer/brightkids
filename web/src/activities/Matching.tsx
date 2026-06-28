import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Pair } from "@/lib/types";
import type { ActivityProps } from "./types";
import { cn, shuffle } from "@/lib/utils";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { useStore } from "@/store/useStore";

type Side = "left" | "right";

// Matching: tap a tile on the left, then its partner on the right. Correct pairs
// lock in with a mint ring; mismatches give a gentle nudge and reset.
export function Matching({ lesson, locale, onCorrect, onWrong, solved }: ActivityProps) {
  const pairs = lesson.pairs ?? [];
  const voiceEnabled = useStore((s) => s.settings?.voice_enabled ?? true);

  const leftCards = useMemo(() => shuffle(pairs), [lesson.id]);
  const rightCards = useMemo(() => shuffle(pairs), [lesson.id]);

  const [picked, setPicked] = useState<{ side: Side; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [missId, setMissId] = useState<string | null>(null);

  function speakPair(p: Pair, side: Side) {
    const text = side === "left" ? p.left_tts || p.left : p.right_tts || p.right || "";
    if (text) speak(text, { locale, enabled: voiceEnabled });
  }

  function tap(side: Side, p: Pair) {
    if (solved || matched.has(p.id)) return;
    play("tap");
    speakPair(p, side);

    if (!picked) {
      setPicked({ side, id: p.id });
      return;
    }
    if (picked.side === side) {
      setPicked({ side, id: p.id });
      return;
    }
    // One from each side selected.
    if (picked.id === p.id) {
      play("pop");
      const next = new Set(matched).add(p.id);
      setMatched(next);
      setPicked(null);
      if (next.size === pairs.length) {
        play("ding");
        onCorrect(lesson.reward.stars);
      }
    } else {
      play("wrong");
      setMissId(p.id);
      onWrong();
      window.setTimeout(() => setMissId(null), 500);
      setPicked(null);
    }
  }

  function tile(side: Side, p: Pair, content: React.ReactNode) {
    const isMatched = matched.has(p.id);
    const isPicked = picked?.side === side && picked.id === p.id;
    return (
      <motion.button
        key={`${side}-${p.id}`}
        whileTap={{ scale: 0.95 }}
        animate={missId === p.id && !isMatched ? { x: [0, -6, 6, 0] } : {}}
        onClick={() => tap(side, p)}
        disabled={solved || isMatched}
        className={cn(
          "tap flex min-h-[4.5rem] items-center justify-center rounded-blob bg-white/95 px-4 py-3 text-3xl text-ink shadow-tile dark:bg-nebula dark:text-cream",
          isMatched && "opacity-50 ring-4 ring-mint",
          isPicked && "ring-4 ring-sun",
        )}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <div dir={lesson.direction} className="grid w-full grid-cols-2 gap-4">
      <div className="flex flex-col gap-3">
        {leftCards.map((p) => tile("left", p, <span className="font-display">{p.left}</span>))}
      </div>
      <div className="flex flex-col gap-3">
        {rightCards.map((p) =>
          tile(
            "right",
            p,
            p.emoji ? <span className="text-5xl">{p.emoji}</span> : <span className="font-display">{p.right}</span>,
          ),
        )}
      </div>
    </div>
  );
}
