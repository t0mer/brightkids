import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Star, Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { data } from "@/lib/data";
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
import { useTitle } from "@/lib/useTitle";

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
  // Bumping `round` remounts the activity, which draws a fresh random sample.
  const [round, setRound] = useState(0);
  // The active sub-question's instruction, reported by stepped activities.
  const [prompt, setPrompt] = useState<{ text: string; tts: string } | null>(null);

  // Browser tab title = the lesson's own title (brand-only while it loads).
  useTitle(lesson?.title);

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

  // Shuffle: draw a new random sample of the same lesson, without navigating.
  const reshuffle = useCallback(() => {
    play("pop");
    setSolved(false);
    setEarned(0);
    setMood("idle");
    setPrompt(null);
    setAlmost(false);
    setRound((r) => r + 1);
  }, []);

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
      if (profile)
        void data.recordProgress(profile.id, lesson.id, stars, lesson.subject, lesson.grade).catch(() => {});
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
  // Lessons with a pool (questions/pairs/problems/comparisons) can be reshuffled
  // for a fresh random sample.
  const poolSize =
    (lesson.questions?.length ?? 0) +
    (lesson.pairs?.length ?? 0) +
    (lesson.problems?.length ?? 0) +
    (lesson.comparisons?.length ?? 0) +
    (lesson.sentences?.length ?? 0) +
    (lesson.glyphs?.length ?? 0);
  const samplable = poolSize > 1;

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

        <div className="flex items-center gap-3">
          <ListenButton text={spokenText} locale={locale} />
          {samplable && (
            <button
              onClick={reshuffle}
              aria-label={t("app.shuffle")}
              className="tap inline-flex items-center gap-2 rounded-blob bg-white/10 px-5 py-3 font-display font-semibold text-cream hover:bg-white/20"
            >
              <Shuffle className="h-6 w-6" />
              {t("app.shuffle")}
            </button>
          )}
        </div>

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
              key={`${lesson.id}-${round}`}
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
              <div className="flex flex-wrap items-center justify-center gap-3">
                {samplable && (
                  <Button size="lg" variant="sun" onClick={reshuffle}>
                    <Shuffle className="h-6 w-6" />
                    {t("app.shuffle")}
                  </Button>
                )}
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
