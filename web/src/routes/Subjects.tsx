import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { SubjectSummary } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/store/useStore";
import { play } from "@/lib/sfx";
import { gradeLetter } from "@/lib/utils";

const SUBJECT_META: Record<string, { glyph: string; ring: string; chip: string }> = {
  hebrew: { glyph: "א", ring: "shadow-glow", chip: "bg-violet" },
  english: { glyph: "Aa", ring: "shadow-glow-mint", chip: "bg-mint" },
  math: { glyph: "1+2", ring: "shadow-glow-coral", chip: "bg-coral" },
};

export function Subjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useStore((s) => s.profile);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);

  useEffect(() => {
    api.subjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  return (
    <AppShell
      back="/"
      title={t("subjects.choose")}
      right={
        <>
          <button
            onClick={() => navigate("/rewards")}
            aria-label={t("rewards.title")}
            className="tap grid place-items-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Star className="h-6 w-6 text-sun" />
          </button>
          <button
            onClick={() => navigate("/settings")}
            aria-label={t("settings.title")}
            className="tap grid place-items-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <SettingsIcon className="h-6 w-6" />
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 pb-4 text-cream/80">
        <span className="text-3xl">{profile?.avatar}</span>
        <span className="font-display text-xl">{profile?.name}</span>
      </div>

      <div className="grid flex-1 content-center gap-5">
        {subjects.map((s, idx) => {
          const meta = SUBJECT_META[s.subject];
          return (
            <motion.button
              key={s.subject}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                play("pop");
                navigate(`/subject/${s.subject}`);
              }}
              className={`tap flex items-center gap-5 rounded-blob bg-white/10 p-6 text-start hover:bg-white/15 ${meta?.ring}`}
            >
              <span
                className={`grid h-20 w-20 shrink-0 place-items-center rounded-blob ${meta?.chip} font-display text-3xl text-white ltr-num`}
              >
                {meta?.glyph}
              </span>
              <span className="flex-1">
                <span className="block font-display text-3xl">{t(`subjects.${s.subject}`)}</span>
                {s.grades.length > 0 && (
                  <span className="text-cream/70">
                    {t("subjects.gradeRange", {
                      from: gradeLetter(Math.min(...s.grades)),
                      to: gradeLetter(Math.max(...s.grades)),
                    })}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </AppShell>
  );
}
