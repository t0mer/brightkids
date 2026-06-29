import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useStore, applyTheme, applyAppearance } from "@/store/useStore";
import { setUiDirection } from "@/i18n";
import { setSfxMuted } from "@/lib/sfx";
import { api } from "@/lib/api";
import { Start } from "@/routes/Start";
import { Subjects } from "@/routes/Subjects";
import { Lessons } from "@/routes/Lessons";
import { LessonPlayer } from "@/routes/LessonPlayer";
import { Rewards } from "@/routes/Rewards";
import { Settings } from "@/routes/Settings";

// RequireProfile redirects to the start screen when no profile is selected.
function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useStore((s) => s.profile);
  if (!profile) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { theme, uiLang, profile, settings, setSettings } = useStore();

  // Apply persisted appearance/theme/language on first paint, then refresh
  // settings from the server so a reload keeps sound/voice/motion/font in sync.
  useEffect(() => {
    applyTheme(theme);
    setUiDirection(uiLang);
    if (settings) {
      applyAppearance(settings);
      setSfxMuted(!settings.sound_enabled);
    }
    if (profile) {
      api
        .getSettings(profile.id)
        .then(setSettings)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route
          path="/subjects"
          element={
            <RequireProfile>
              <Subjects />
            </RequireProfile>
          }
        />
        <Route
          path="/subject/:subject"
          element={
            <RequireProfile>
              <Lessons />
            </RequireProfile>
          }
        />
        <Route
          path="/lesson/:id"
          element={
            <RequireProfile>
              <LessonPlayer />
            </RequireProfile>
          }
        />
        <Route
          path="/rewards"
          element={
            <RequireProfile>
              <Rewards />
            </RequireProfile>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireProfile>
              <Settings />
            </RequireProfile>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
