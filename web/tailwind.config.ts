import type { Config } from "tailwindcss";

// BrightKids "cosmic academy" palette — soft deep-indigo night sky with a few
// bright, friendly accents. Kid-bright but disciplined, not garish.
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B1B3A", // deep indigo night
        midnight: "#13132B", // darker panel
        nebula: "#2A2A52",
        cream: "#FBF7FF", // soft warm white (violet tint)
        violet: { DEFAULT: "#6C5CE7", soft: "#A99BFF", deep: "#4B3FB8" },
        coral: { DEFAULT: "#FF8A5B", soft: "#FFB48F" },
        mint: { DEFAULT: "#2EC4B6", soft: "#7FE0D6" },
        sun: { DEFAULT: "#FFD166", soft: "#FFE3A3" },
        // Subject identity colors.
        hebrew: "#6C5CE7",
        english: "#2EC4B6",
        math: "#FF8A5B",
      },
      fontFamily: {
        display: ['"Fredoka"', '"Varela Round"', "system-ui", "sans-serif"],
        body: ['"Rubik"', '"Varela Round"', "system-ui", "sans-serif"],
        dyslexic: ['"OpenDyslexic"', '"Varela Round"', '"Rubik"', "sans-serif"],
      },
      borderRadius: {
        xl2: "1.75rem",
        blob: "2.5rem",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(108,92,231,0.55)",
        "glow-mint": "0 0 40px -8px rgba(46,196,182,0.55)",
        "glow-coral": "0 0 40px -8px rgba(255,138,91,0.55)",
        tile: "0 12px 32px -12px rgba(0,0,0,0.45)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        twinkle: {
          "0%,100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        pop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        pop: "pop 0.3s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
