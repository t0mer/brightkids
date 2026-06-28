import { useNavigate } from "react-router-dom";
import { Moon, Sun, ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  back?: string | number;
  title?: string;
  right?: React.ReactNode;
  className?: string;
}

// AppShell is the cosmic-academy frame: a deep-indigo starfield with a calm top
// bar. Keeps page chrome consistent and quiet so the activity is the focus.
export function AppShell({ children, back, title, right, className }: AppShellProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useStore();
  const isRtl = i18n.language === "he";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-b from-ink via-midnight to-ink text-cream">
      <div className="starfield pointer-events-none absolute inset-0 opacity-60 animate-twinkle" />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            {back !== undefined && (
              <button
                onClick={() => (typeof back === "number" ? navigate(back) : navigate(back))}
                aria-label={t("app.back")}
                className="tap grid place-items-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <BackIcon className="h-6 w-6" />
              </button>
            )}
            {title && <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            {right}
            <button
              onClick={toggleTheme}
              aria-label={t("settings.theme")}
              className="tap grid place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              {theme === "dark" ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>
          </div>
        </header>
        <main className={cn("flex flex-1 flex-col px-4 pb-8", className)}>{children}</main>
      </div>
    </div>
  );
}
