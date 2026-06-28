import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type BiboMood = "idle" | "cheer" | "oops" | "think";

interface BiboProps {
  mood?: BiboMood;
  size?: number;
  className?: string;
}

// Bibo — the friendly droid guide. The signature element of BrightKids: a
// rounded little robot with a glowing antenna who floats, cheers, and gently
// reacts. Pure inline SVG so it scales crisply and ships with no image assets.
export function Bibo({ mood = "idle", size = 140, className }: BiboProps) {
  const reduce =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion");

  const bodyAnim =
    mood === "cheer"
      ? { y: [0, -16, 0], rotate: [0, -4, 4, 0] }
      : mood === "oops"
        ? { rotate: [0, -8, 8, -4, 0], y: [0, 4, 0] }
        : mood === "think"
          ? { rotate: [0, 3, -3, 0] }
          : { y: [0, -8, 0] };

  const transition = reduce
    ? { duration: 0 }
    : {
        duration: mood === "idle" ? 4 : 0.9,
        repeat: mood === "idle" ? Infinity : mood === "think" ? Infinity : 0,
        ease: "easeInOut" as const,
      };

  // Eyes: happy arcs when cheering, soft circles otherwise.
  const cheering = mood === "cheer";

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      className={cn("select-none", className)}
      role="img"
      aria-label="Bibo"
      animate={bodyAnim}
      transition={transition}
    >
      <defs>
        <radialGradient id="bibo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD166" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bibo-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A99BFF" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
        <linearGradient id="bibo-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13132B" />
          <stop offset="100%" stopColor="#2A2A52" />
        </linearGradient>
      </defs>

      {/* Antenna + glowing bulb */}
      <circle cx="80" cy="20" r="16" fill="url(#bibo-glow)" />
      <line x1="80" y1="34" x2="80" y2="48" stroke="#4B3FB8" strokeWidth="4" strokeLinecap="round" />
      <motion.circle
        cx="80"
        cy="22"
        r="7"
        fill="#FFD166"
        animate={reduce ? {} : { scale: [1, 1.18, 1], opacity: [0.85, 1, 0.85] }}
        transition={reduce ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Body */}
      <rect x="34" y="46" width="92" height="86" rx="34" fill="url(#bibo-body)" />
      <rect x="34" y="46" width="92" height="86" rx="34" fill="none" stroke="#4B3FB8" strokeWidth="3" />

      {/* Visor */}
      <rect x="48" y="62" width="64" height="44" rx="22" fill="url(#bibo-visor)" />

      {/* Eyes */}
      {cheering ? (
        <>
          <path d="M62 86 q8 -12 16 0" stroke="#7FE0D6" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M84 86 q8 -12 16 0" stroke="#7FE0D6" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <motion.circle
            cx="70"
            cy="84"
            r="6.5"
            fill="#7FE0D6"
            animate={reduce ? {} : { scaleY: [1, 0.1, 1] }}
            transition={reduce ? { duration: 0 } : { duration: 0.25, repeat: Infinity, repeatDelay: 3 }}
            style={{ transformOrigin: "70px 84px" }}
          />
          <motion.circle
            cx="92"
            cy="84"
            r="6.5"
            fill="#7FE0D6"
            animate={reduce ? {} : { scaleY: [1, 0.1, 1] }}
            transition={reduce ? { duration: 0 } : { duration: 0.25, repeat: Infinity, repeatDelay: 3 }}
            style={{ transformOrigin: "92px 84px" }}
          />
        </>
      )}

      {/* Mouth / cheek light */}
      {mood === "oops" ? (
        <path d="M70 116 q10 -8 20 0" stroke="#FFB48F" strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M70 116 q10 8 20 0" stroke="#FFD166" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}

      {/* Arms */}
      <motion.circle
        cx="28"
        cy="92"
        r="9"
        fill="#A99BFF"
        animate={cheering && !reduce ? { y: [-2, -14, -2] } : {}}
        transition={{ duration: 0.6, repeat: cheering ? 2 : 0 }}
      />
      <motion.circle
        cx="132"
        cy="92"
        r="9"
        fill="#A99BFF"
        animate={cheering && !reduce ? { y: [-2, -14, -2] } : {}}
        transition={{ duration: 0.6, repeat: cheering ? 2 : 0 }}
      />

      {/* Feet */}
      <rect x="56" y="130" width="18" height="12" rx="6" fill="#4B3FB8" />
      <rect x="86" y="130" width="18" height="12" rx="6" fill="#4B3FB8" />
    </motion.svg>
  );
}
