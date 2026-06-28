import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { AVATARS } from "@/lib/avatars";
import { useStore } from "@/store/useStore";
import { Bibo } from "@/components/Bibo";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { play } from "@/lib/sfx";

export function Start() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setProfile, setSettings } = useStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  async function choose(p: Profile) {
    play("pop");
    setProfile(p);
    try {
      const s = await api.getSettings(p.id);
      setSettings(s);
    } catch {
      /* settings fall back to defaults */
    }
    navigate("/subjects");
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Bibo mood="idle" size={170} />
        <div>
          <h1 className="font-display text-5xl sm:text-6xl text-sun drop-shadow">{t("app.title")}</h1>
          <p className="mt-2 text-lg text-cream/80">{t("app.tagline")}</p>
        </div>

        <h2 className="mt-2 font-display text-2xl">{t("profiles.who")}</h2>

        {loading ? (
          <p className="text-cream/70">{t("app.loading")}</p>
        ) : (
          <div className="grid w-full max-w-xl grid-cols-2 gap-4 sm:grid-cols-3">
            {profiles.map((p) => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => choose(p)}
                className="tap flex flex-col items-center gap-2 rounded-blob bg-white/10 p-5 hover:bg-white/15"
              >
                <span className="text-5xl">{p.avatar || "🙂"}</span>
                <span className="font-display text-xl">{p.name}</span>
              </motion.button>
            ))}
            <NewPlayer
              onCreated={(p) => {
                setProfiles((prev) => [p, ...prev]);
                void choose(p);
              }}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NewPlayer({ onCreated }: { onCreated: (p: Profile) => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const p = await api.createProfile(name.trim(), avatar, i18n.language);
      setOpen(false);
      setName("");
      onCreated(p);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="tap flex flex-col items-center justify-center gap-2 rounded-blob border-2 border-dashed border-white/30 p-5 hover:bg-white/10"
        >
          <Plus className="h-10 w-10" />
          <span className="font-display text-xl">{t("profiles.add")}</span>
        </motion.button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="font-display text-2xl">{t("profiles.add")}</DialogTitle>
        <div className="mt-4 flex flex-col gap-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profiles.namePlaceholder")}
            maxLength={20}
            className="rounded-2xl border-2 border-violet/40 bg-white px-4 py-3 text-xl text-ink focus:outline-none"
          />
          <p className="font-display text-lg text-ink dark:text-cream">{t("profiles.pickAvatar")}</p>
          <div className="grid grid-cols-5 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`tap grid place-items-center rounded-2xl p-2 text-3xl ${
                  avatar === a ? "bg-mint/40 ring-2 ring-mint" : "bg-black/5 dark:bg-white/10"
                }`}
                aria-label={a}
              >
                {a}
              </button>
            ))}
          </div>
          <Button size="lg" onClick={create} disabled={!name.trim() || busy}>
            {t("profiles.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
