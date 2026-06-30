import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { LessonSummary } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/store/useStore";
import { play } from "@/lib/sfx";
import { gradeLetter } from "@/lib/utils";

const ACTIVITY_ICON: Record<string, string> = {
  "letter-recognition": "🔤",
  tracing: "✏️",
  matching: "🧩",
  "multiple-choice": "🎯",
  counting: "🔢",
  arithmetic: "➕",
  "drag-drop": "🔀",
  comparison: "⚖️",
};

export function Lessons() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subject = "" } = useParams();
  const profile = useStore((s) => s.profile);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [stars, setStars] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Fetch every lesson for the subject (all grades — there is no grade picker).
  useEffect(() => {
    setLoading(true);
    api
      .lessons(subject, 0)
      .then(setLessons)
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, [subject]);

  useEffect(() => {
    if (!profile) return;
    api
      .progress(profile.id)
      .then((p) => {
        const map: Record<string, number> = {};
        for (const l of p.lessons) map[l.lesson_id] = l.stars;
        setStars(map);
      })
      .catch(() => setStars({}));
  }, [profile, subject]);

  // Group lessons by grade so the long list stays organised without a picker.
  const byGrade = useMemo(() => {
    const groups = new Map<number, LessonSummary[]>();
    for (const l of lessons) {
      const arr = groups.get(l.grade) ?? [];
      arr.push(l);
      groups.set(l.grade, arr);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [lessons]);

  return (
    <AppShell back="/subjects" title={t(`subjects.${subject}`)}>
      {loading ? (
        <p className="text-cream/70">{t("app.loading")}</p>
      ) : lessons.length === 0 ? (
        <p className="text-cream/70">{t("lessons.empty")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {byGrade.map(([grade, items]) => (
            <section key={grade} className="flex flex-col gap-3">
              <h2 className="font-display text-lg text-cream/70">{t("grades.grade", { n: gradeLetter(grade) })}</h2>
              {items.map((l, idx) => {
                const dir = l.locale.startsWith("he") ? "rtl" : "ltr";
                return (
                  <motion.button
                    key={l.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      play("pop");
                      navigate(`/lesson/${l.id}`);
                    }}
                    className="tap flex items-center gap-4 rounded-blob bg-white/10 p-4 text-start hover:bg-white/15"
                  >
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl">
                      {ACTIVITY_ICON[l.activity] ?? "⭐"}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-2xl" dir={dir}>
                        {l.title}
                      </span>
                      <span className="text-sm text-cream/60">{t(`activity.${l.activity}`)}</span>
                    </span>
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3].map((n) => (
                        <Star
                          key={n}
                          className={`h-5 w-5 ${
                            (stars[l.id] ?? 0) >= n ? "fill-sun text-sun" : "text-white/25"
                          }`}
                        />
                      ))}
                    </span>
                  </motion.button>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
