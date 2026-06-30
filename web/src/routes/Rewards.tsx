import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { data } from "@/lib/data";
import type { ProgressSummary } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Bibo } from "@/components/Bibo";
import { useStore } from "@/store/useStore";
import { useTitle } from "@/lib/useTitle";

export function Rewards() {
  const { t } = useTranslation();
  const profile = useStore((s) => s.profile);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  useTitle(t("rewards.title"));

  useEffect(() => {
    if (!profile) return;
    data.progress(profile.id).then(setSummary).catch(() => setSummary(null));
  }, [profile]);

  const total = summary?.total_stars ?? 0;
  const streak = summary?.streak ?? 0;
  const done = summary?.lessons.length ?? 0;

  return (
    <AppShell back="/subjects" title={t("rewards.title")}>
      <div className="flex flex-col items-center gap-6">
        <Bibo mood={total > 0 ? "cheer" : "idle"} size={120} />

        <div className="grid w-full max-w-md grid-cols-3 gap-3">
          <Stat icon={<Star className="h-7 w-7 fill-sun text-sun" />} value={total} label={t("rewards.stars")} />
          <Stat icon={<Flame className="h-7 w-7 text-coral" />} value={streak} label={t("rewards.streak")} />
          <Stat
            icon={<span className="text-2xl">🎓</span>}
            value={done}
            label={t("rewards.completed")}
          />
        </div>

        {done === 0 ? (
          <p className="text-cream/70">{t("rewards.empty")}</p>
        ) : (
          <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
            {summary!.lessons.map((l, i) => (
              <motion.div
                key={l.lesson_id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-1 rounded-blob bg-white/10 px-3 py-2"
                title={l.lesson_id}
              >
                {Array.from({ length: l.stars }).map((_, n) => (
                  <Star key={n} className="h-4 w-4 fill-sun text-sun" />
                ))}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-blob bg-white/10 p-4">
      {icon}
      <span className="font-display text-3xl ltr-num">{value}</span>
      <span className="text-center text-xs text-cream/70">{label}</span>
    </div>
  );
}
