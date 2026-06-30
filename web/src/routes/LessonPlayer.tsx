import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Lesson, LessonSummary } from "@/lib/types";
import { ACTIVITY_RENDERERS } from "@/activities";
import { AppShell } from "@/components/AppShell";
import { Bibo, type BiboMood } from "@/components/Bibo";
import { ListenButton } from "@/components/ListenButton";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { bigCelebrate, celebrate } from "@/lib/confetti";

export function LessonPlayer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { profile, settings } = useStore();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [siblings, setSiblings] = useState<LessonSummary[]>([]);
  const [solved, setSolved] = useState(false);
  const [earned, setEarned] = useState(0);
  const [mood, setMood] = useState<BiboMood>("idle");
  const [almost, setAlmost] = useState(false);
  // The active sub-question's instruction, reported by stepped activities.
  const [prompt, setPrompt] = useState<{ text: string; tts: string } | null>(null);

  const reduceMotion = settings?.reduce_motion ?? false;
  const voiceEnabled = settings?.voice_enabled ?? true;
  // TTS speaks the lesson's own language (Hebrew lessons and Math both narrate
  // in Hebrew; English in English).
  const locale = lesson?.locale || "he-IL";
  const titleDir = locale.startsWith("he") ? "rtl" : "ltr";

  // Load the lesson + its grade siblings (for "next").
  useEffect(() => {
    setSolved(false);
    setEarned(0);
    setMood("idle");
    setPrompt(null);
    api.lesson(id).then((l) => {
      setLesson(l);
      api.lessons(l.subject, l.grade).then(setSiblings).catch(() => setSiblings([]));
    });
  }, [id]);

  // No auto-narration — the prompt is only spoken when the child taps Listen.
  const onPrompt = useCallback((p: { text: string; tts: string }) => setPrompt(p), []);

  // Shown instruction text and spoken text: the active question overrides the
  // lesson-level instruction when a set reports one.
  const instructionText = prompt?.text || lesson?.instruction || lesson?.prompt_tts || "";
  const spokenText = prompt?.tts || lesson?.prompt_tts || "";

  const onCorrect = useCallback(
    (stars: number) => {
      if (!lesson || solved) return;
      setSolved(true);
      setEarned(stars);
      setMood("cheer");
      play("celebrate");
      celebrate(lesson.reward.effect, reduceMotion);
      bigCelebrate(reduceMotion);
      speak(t("activity.great"), { locale, enabled: voiceEnabled });
      if (profile) void api.recordProgress(profile.id, lesson.id, stars).catch(() => {});
    },
    [lesson, solved, reduceMotion, locale, voiceEnabled, profile, t],
  );

  const onWrong = useCallback(() => {
    setMood("oops");
    setAlmost(true);
    window.setTimeout(() => {
      setAlmost(false);
      setMood("idle");
    }, 1200);
  }, []);

  if (!lesson) {
    return (
      <AppShell back={-1}>
        <p className="m-auto text-cream/70">{t("app.loading")}</p>
      </AppShell>
    );
  }

  const Renderer = ACTIVITY_RENDERERS[lesson.activity];
  const idx = siblings.findIndex((s) => s.id === lesson.id);
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const lessonsPath = `/subject/${lesson.subject}/grade/${lesson.grade}`;

  return (
    <AppShell back={lessonsPath}>
      <div className="flex flex-1 flex-col items-center gap-5">
        {/* Prompt + Bibo */}
        <div className="flex w-full items-center justify-center gap-3">
          <Bibo mood={mood} size={96} />
          <h2 dir={titleDir} className="font-display text-2xl sm:text-3xl text-center">
            {lesson.title}
          </h2>
        </div>

        {/* Instruction text — always Hebrew (RTL). Spoken narration may differ
            (English for English lessons); the text guides in Hebrew for all. */}
        <p dir="rtl" className="max-w-prose px-2 text-center text-lg text-cream/90">
          {instructionText}
        </p>

        <ListenButton text={spokenText} locale={locale} />

        {/* "Almost!" gentle nudge */}
        <AnimatePresence>
          {almost && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-blob bg-coral/90 px-5 py-2 font-display text-ink"
            >
              {t("activity.almost")}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Activity */}
        <div className="flex w-full flex-1 items-center justify-center py-2">
          {Renderer ? (
            <Renderer
              lesson={lesson}
              locale={locale}
              onCorrect={onCorrect}
              onWrong={onWrong}
              solved={solved}
              onPrompt={onPrompt}
            />
          ) : null}
        </div>

        {/* Success panel */}
        <AnimatePresence>
          {solved && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full flex-col items-center gap-4 rounded-blob bg-white/10 p-5"
            >
              <p className="font-display text-3xl text-sun">{t("activity.great")}</p>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, n) => (
                  <Star
                    key={n}
                    className={`h-9 w-9 ${n < earned ? "fill-sun text-sun" : "text-white/25"}`}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                {next ? (
                  <Button
                    size="lg"
                    onClick={() => {
                      play("pop");
                      navigate(`/lesson/${next.id}`);
                    }}
                  >
                    {t("app.next")}
                  </Button>
                ) : (
                  <Button size="lg" variant="mint" onClick={() => navigate(lessonsPath)}>
                    {t("app.done")}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
