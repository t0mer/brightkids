// Sound effects synthesized with the Web Audio API — no audio assets needed, so
// the app stays fully offline-capable. A gentle, non-punitive palette: success
// chimes up, "try again" is a soft low blip (never a harsh buzzer).

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers suspend the context until a user gesture; resume on demand.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, gainPeak = 0.18): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type Sfx = "ding" | "pop" | "chime" | "tap" | "wrong" | "celebrate";

let muted = false;

/** setSfxMuted toggles all sound effects. */
export function setSfxMuted(m: boolean): void {
  muted = m;
}

/** play emits a named sound effect, unless muted. */
export function play(name: Sfx): void {
  if (muted) return;
  switch (name) {
    case "tap":
      tone(520, 0, 0.08, 0.1);
      break;
    case "pop":
      tone(680, 0, 0.1, 0.14);
      break;
    case "ding":
      tone(880, 0, 0.16);
      tone(1320, 0.04, 0.18);
      break;
    case "chime":
      tone(660, 0, 0.16);
      tone(990, 0.08, 0.18);
      tone(1320, 0.16, 0.22);
      break;
    case "celebrate":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25));
      break;
    case "wrong":
      // Soft, encouraging low blip — gentle, never shaming.
      tone(300, 0, 0.14, 0.1);
      tone(240, 0.1, 0.16, 0.08);
      break;
  }
}

/** rewardSfx maps a lesson reward sound name to a synthesized effect. */
export function rewardSfx(name: string): Sfx {
  if (name === "pop" || name === "chime") return name;
  return "ding";
}
