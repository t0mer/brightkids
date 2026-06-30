import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { speak } from "@/lib/tts";
import { play } from "@/lib/sfx";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

interface ListenButtonProps {
  text: string;
  locale: string;
  className?: string;
  big?: boolean;
}

// ListenButton narrates a prompt on demand. Only rendered when text-to-speech
// is enabled via server config; otherwise it's hidden entirely. Respects the
// per-profile voice toggle.
export function ListenButton({ text, locale, className, big }: ListenButtonProps) {
  const { t } = useTranslation();
  const ttsEnabled = useStore((s) => s.ttsEnabled);
  const voiceEnabled = useStore((s) => s.settings?.voice_enabled ?? true);

  if (!ttsEnabled) return null;

  return (
    <button
      onClick={() => {
        play("tap");
        speak(text, { locale, enabled: voiceEnabled });
      }}
      aria-label={t("app.listen")}
      className={cn(
        "tap inline-flex items-center gap-2 rounded-blob bg-sun px-5 py-3 font-display font-semibold text-ink shadow-glow transition-transform active:scale-95",
        big && "text-xl px-7 py-4",
        className,
      )}
    >
      <Volume2 className={cn("h-6 w-6", big && "h-7 w-7")} />
      {t("app.listen")}
    </button>
  );
}
