import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { data } from "@/lib/data";
import type { Settings as SettingsT } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import { setUiDirection } from "@/i18n";

export function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, settings, setSettings, setProfile, uiLang, setUiLang } = useStore();

  // No profile at all → back to the start screen.
  if (!profile) {
    navigate("/");
    return null;
  }
  // Profile present but settings still loading (e.g. after a hard reload) —
  // App bootstrap fetches them; show a brief loading state instead of bouncing.
  if (!settings) {
    return (
      <AppShell back="/subjects" title={t("settings.title")}>
        <p className="m-auto text-cream/70">{t("app.loading")}</p>
      </AppShell>
    );
  }

  // Persist a settings change. Settings are freely editable by the child;
  // only the destructive "delete profile" action is grown-up gated.
  function patch(p: Partial<SettingsT>) {
    const next = { ...settings!, ...p };
    setSettings(next);
    void data.updateSettings(next).catch(() => {});
  }

  function changeLang(lang: string) {
    setUiLang(lang);
    setUiDirection(lang);
    patch({ ui_lang: lang });
  }

  async function remove() {
    await data.deleteProfile(profile!.id).catch(() => {});
    setProfile(null);
    setSettings(null);
    navigate("/");
  }

  return (
    <AppShell back="/subjects" title={t("settings.title")}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Card className="flex flex-col gap-1 text-ink dark:text-cream">
          <Row label={t("settings.sound")}>
            <Switch
              checked={settings.sound_enabled}
              onCheckedChange={(v) => patch({ sound_enabled: v })}
            />
          </Row>
          <Row label={t("settings.voice")}>
            <Switch
              checked={settings.voice_enabled}
              onCheckedChange={(v) => patch({ voice_enabled: v })}
            />
          </Row>
          <Row label={t("settings.reduceMotion")}>
            <Switch
              checked={settings.reduce_motion}
              onCheckedChange={(v) => patch({ reduce_motion: v })}
            />
          </Row>
          <Row label={t("settings.dyslexia")}>
            <Switch
              checked={settings.dyslexia_font}
              onCheckedChange={(v) => patch({ dyslexia_font: v })}
            />
          </Row>
          <Row label={t("settings.language")}>
            <div className="flex gap-2">
              {["he", "en"].map((l) => (
                <button
                  key={l}
                  onClick={() => changeLang(l)}
                  className={`tap rounded-2xl px-4 py-2 font-display ${
                    uiLang === l ? "bg-violet text-white" : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {l === "he" ? "עברית" : "EN"}
                </button>
              ))}
            </div>
          </Row>
        </Card>

        <Card className="flex items-center justify-between gap-4">
          <span className="font-display text-ink dark:text-cream">{t("settings.deleteProfile")}</span>
          <Button
            variant="coral"
            aria-label={t("settings.deleteProfile")}
            onClick={() => void remove()}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="font-display text-lg">{label}</span>
      {children}
    </div>
  );
}
