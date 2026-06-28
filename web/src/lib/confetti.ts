import confetti from "canvas-confetti";

const KID_COLORS = ["#6C5CE7", "#2EC4B6", "#FF8A5B", "#FFD166", "#A99BFF"];

/** celebrate fires a reward burst. Respects reduced motion (no-op when set). */
export function celebrate(effect = "confetti", reduceMotion = false): void {
  if (reduceMotion) return;
  if (effect === "stars" || effect === "sparkle") {
    confetti({
      particleCount: 40,
      spread: 70,
      startVelocity: 28,
      scalar: 1.2,
      shapes: ["star"],
      colors: KID_COLORS,
      origin: { y: 0.6 },
    });
    return;
  }
  confetti({
    particleCount: 90,
    spread: 100,
    startVelocity: 35,
    colors: KID_COLORS,
    origin: { y: 0.6 },
  });
}

/** bigCelebrate is a longer burst for finishing a lesson. */
export function bigCelebrate(reduceMotion = false): void {
  if (reduceMotion) return;
  const end = Date.now() + 800;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors: KID_COLORS });
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors: KID_COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
