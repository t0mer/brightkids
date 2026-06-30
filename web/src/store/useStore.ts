import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile, Settings } from "@/lib/types";
import { setSfxMuted } from "@/lib/sfx";

interface AppState {
  profile: Profile | null;
  settings: Settings | null;
  uiLang: string;
  theme: "light" | "dark";
  // Global text-to-speech availability, from server config (not persisted).
  ttsEnabled: boolean;

  setProfile: (p: Profile | null) => void;
  setSettings: (s: Settings | null) => void;
  setUiLang: (l: string) => void;
  setTtsEnabled: (v: boolean) => void;
  toggleTheme: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      settings: null,
      uiLang: "he",
      theme: "light",
      ttsEnabled: false,

      setProfile: (p) => set({ profile: p }),
      setSettings: (s) => {
        if (s) {
          setSfxMuted(!s.sound_enabled);
          applyAppearance(s);
          if (s.ui_lang) set({ uiLang: s.ui_lang });
        }
        set({ settings: s });
      },
      setUiLang: (l) => set({ uiLang: l }),
      setTtsEnabled: (v) => set({ ttsEnabled: v }),
      toggleTheme: () =>
        set((st) => {
          const theme = st.theme === "dark" ? "light" : "dark";
          applyTheme(theme);
          return { theme };
        }),
    }),
    {
      name: "brightkids",
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        uiLang: s.uiLang,
        theme: s.theme,
      }),
    },
  ),
);

/** applyAppearance reflects accessibility settings onto the document root. */
export function applyAppearance(s: Settings): void {
  const root = document.documentElement;
  root.classList.toggle("dyslexic", s.dyslexia_font);
  root.classList.toggle("reduce-motion", s.reduce_motion);
}

/** applyTheme toggles dark mode on the document root. */
export function applyTheme(theme: "light" | "dark"): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
