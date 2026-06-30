import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Item } from "@/lib/types";
import type { ActivityProps } from "./types";
import { cn, shuffle, sample } from "@/lib/utils";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { useStore } from "@/store/useStore";

// How many sentences from the pool to present per play.
const SAMPLE = 4;

type Round = { items: Item[]; solution: string[] };

// DragDrop: arrange tokens into the correct order (tap-to-build). A lesson may
// carry a single items+solution, or a `sentences` pool ("רצף המשפט") — a random
// sample of which is stepped through, scrambled, one sentence at a time.
export function DragDrop({ lesson, locale, onCorrect, onWrong, solved }: ActivityProps) {
  const voiceEnabled = useStore((s) => s.settings?.voice_enabled ?? true);

  // Build the rounds for this play: a sample of sentences, or the single set.
  const rounds = useMemo<Round[]>(() => {
    if (lesson.sentences && lesson.sentences.length > 0) {
      return sample(lesson.sentences, SAMPLE).map((words) => ({
        items: words.map((w, k) => ({ id: `w${k}`, label: w })),
        solution: words.map((_, k) => `w${k}`),
      }));
    }
    return [{ items: lesson.items ?? [], solution: lesson.solution ?? [] }];
  }, [lesson.id]);

  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  const round = rounds[index];
  const byId = useMemo(() => new Map(round.items.map((i) => [i.id, i])), [lesson.id, index]);
  const pool = useMemo(() => shuffle(round.items), [lesson.id, index]);
  const isLast = index === rounds.length - 1;
  const showProgress = rounds.length > 1;

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
    if (next.length === round.solution.length) check(next);
  }

  function check(next: string[]) {
    // Compare by label so repeated tokens (e.g. the two א in אִמָּא) are
    // interchangeable: any arrangement that reads correctly is accepted.
    const correct = next.every(
      (id, i) => byId.get(id)?.label === byId.get(round.solution[i])?.label,
    );
    if (correct) {
      if (isLast) {
        play("ding");
        onCorrect(lesson.reward.stars);
      } else {
        play("pop");
        setIndex((i) => i + 1);
        setPlaced([]);
      }
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
    <div dir={lesson.direction} className="flex w-full flex-col items-center gap-6">
      {showProgress && (
        <div className="flex w-full max-w-xs flex-col gap-1">
          <span className="ltr-num text-center text-sm text-cream/70">
            {index + (solved ? 1 : 0)} / {rounds.length}
          </span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-mint transition-all"
              style={{ width: `${((index + (solved ? 1 : 0)) / rounds.length) * 100}%` }}
            />
          </div>
        </div>
      )}

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
