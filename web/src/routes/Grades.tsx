import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { play } from "@/lib/sfx";

export function Grades() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subject = "" } = useParams();
  const [grades, setGrades] = useState<number[]>([]);

  useEffect(() => {
    api
      .subjects()
      .then((subs) => setGrades(subs.find((s) => s.subject === subject)?.grades ?? []))
      .catch(() => setGrades([]));
  }, [subject]);

  return (
    <AppShell back="/subjects" title={t(`subjects.${subject}`)}>
      <p className="pb-6 text-center font-display text-2xl text-cream/80">{t("grades.choose")}</p>
      <div className="grid grid-cols-2 content-center gap-5 sm:grid-cols-4">
        {grades.map((g, idx) => (
          <motion.button
            key={g}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.07 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              play("pop");
              navigate(`/subject/${subject}/grade/${g}`);
            }}
            className="tap flex aspect-square flex-col items-center justify-center gap-1 rounded-blob bg-white/10 shadow-tile hover:bg-white/15"
          >
            <span className="font-display text-6xl text-sun ltr-num">{g}</span>
            <span className="text-cream/70">{t("grades.grade", { n: g })}</span>
          </motion.button>
        ))}
      </div>
    </AppShell>
  );
}
