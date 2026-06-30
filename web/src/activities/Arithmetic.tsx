import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Problem } from "@/lib/types";
import type { ActivityProps } from "./types";
import { cn, sample } from "@/lib/utils";
import { play } from "@/lib/sfx";

// How many problems from the pool to present per play.
const SAMPLE = 8;

const OP_LABEL: Record<string, string> = {
  "+": "+",
  "-": "−",
  x: "×",
  "*": "×",
  "/": "÷",
  "÷": "÷",
};

// Arithmetic shows an equation and a numeric keypad. A lesson may carry a single
// `problem` or a `problems` set (a practice run); the activity steps through the
// set and only completes the lesson once every problem is solved. Equations
// always render LTR (BiDi-isolated) even inside an RTL screen.
export function Arithmetic({ lesson, onCorrect, onWrong, solved }: ActivityProps) {
  const { t } = useTranslation();

  const problems = useMemo<Problem[]>(() => {
    const pool = lesson.problems?.length ? lesson.problems : lesson.problem ? [lesson.problem] : [];
    return sample(pool, SAMPLE);
  }, [lesson.id]);

  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [shake, setShake] = useState(false);

  const p = problems[index];
  if (!p || !p.operands || p.operands.length < 2) return null;

  const op = OP_LABEL[p.operator] ?? p.operator;
  const equation = `${p.operands.join(` ${op} `)} = `;
  const isLast = index === problems.length - 1;
  const showProgress = problems.length > 1;

  function check() {
    if (solved || entry === "") return;
    if (Number(entry) === p!.answer) {
      if (isLast) {
        play("ding");
        onCorrect(lesson.reward.stars);
      } else {
        play("pop");
        setIndex((i) => i + 1);
        setEntry("");
      }
    } else {
      play("wrong");
      setShake(true);
      onWrong();
      window.setTimeout(() => setShake(false), 600);
      setEntry("");
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {showProgress && (
        <div className="flex w-full max-w-xs flex-col gap-1">
          <span className="ltr-num text-center text-sm text-cream/70">
            {index + (solved ? 1 : 0)} / {problems.length}
          </span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-mint transition-all"
              style={{ width: `${((index + (solved ? 1 : 0)) / problems.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <motion.div
        animate={shake ? { x: [0, -8, 8, -6, 0] } : {}}
        className="ltr-num flex items-center gap-3 rounded-blob bg-white/95 px-8 py-6 font-display text-5xl text-ink shadow-tile dark:bg-nebula dark:text-cream"
      >
        <span>{equation}</span>
        <span className={cn("min-w-[3rem] text-center", solved ? "text-mint" : "text-violet")}>
          {entry || "?"}
        </span>
      </motion.div>

      <div dir="ltr" className="grid w-full max-w-xs grid-cols-3 gap-3">
        {keys.map((k) => (
          <motion.button
            key={k}
            whileTap={{ scale: 0.92 }}
            disabled={solved}
            onClick={() => {
              play("tap");
              if (k === "del") setEntry((e) => e.slice(0, -1));
              else if (k === "ok") check();
              else if (entry.length < 4) setEntry((e) => e + k);
            }}
            className={cn(
              "tap grid h-16 place-items-center rounded-blob font-display text-3xl shadow-tile",
              k === "ok"
                ? "bg-mint text-ink"
                : k === "del"
                  ? "bg-white/10 text-cream"
                  : "bg-white/95 text-ink dark:bg-nebula dark:text-cream",
            )}
            aria-label={k === "ok" ? t("activity.checkAnswer") : k === "del" ? t("activity.clear") : k}
          >
            {k === "del" ? <Delete className="h-7 w-7" /> : k === "ok" ? "✓" : <span className="ltr-num">{k}</span>}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
