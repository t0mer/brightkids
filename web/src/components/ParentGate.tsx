import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ParentGateProps {
  trigger: React.ReactNode;
  onUnlock: () => void;
}

// ParentGate guards settings changes and profile deletion behind a small
// multiplication a grown-up can solve — a common kid-app safeguard. Numbers are
// chosen from 6–12 so they're non-trivial for a young child.
export function ParentGate({ trigger, onUnlock }: ParentGateProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const challenge = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 6 + Math.floor(Math.random() * 7);
    return { a, b, answer: a * b };
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number(value) === challenge.answer) {
      setOpen(false);
      setValue("");
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setValue("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setValue("");
        setError(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle className="font-display text-2xl mb-4">{t("parentGate.title")}</DialogTitle>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-xl ltr-num">
            {t("parentGate.prompt", { a: challenge.a, b: challenge.b })}
          </p>
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="ltr-num rounded-2xl border-2 border-violet/40 bg-white px-4 py-3 text-2xl text-ink text-center focus:outline-none"
            aria-label={t("parentGate.title")}
          />
          {error && <p className="text-coral font-semibold">{t("parentGate.wrong")}</p>}
          <Button type="submit" size="lg">
            {t("activity.checkAnswer")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
