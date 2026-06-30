// Text-to-speech via the Web Speech API, with locale-aware voice selection.
// A pre-recorded audio fallback can be layered later via Lesson.audio paths.

import { ttsEnabled } from "./appConfig";

let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  const lang = locale.toLowerCase();
  const base = lang.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
}

export interface SpeakOptions {
  locale?: string;
  enabled?: boolean;
  rate?: number;
}

/** speak narrates text in the requested locale. No-op when text-to-speech is
 *  disabled (globally via config, or per-profile), or unsupported, so callers
 *  never need to guard. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const { locale = "he-IL", enabled = true, rate = 0.92 } = opts;
  if (!ttsEnabled() || !enabled || !text) return; // off by default unless enabled by config
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  u.rate = rate;
  u.pitch = 1.1; // a touch brighter for a kid-friendly read
  const voice = pickVoice(locale);
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

/** stopSpeaking cancels any in-flight narration. */
export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
