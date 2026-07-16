"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    // Surface the error in the console (and any future client error tracking);
    // without this, production render crashes are invisible.
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-heading font-bold text-text-primary">{t("title")}</h1>
      <p className="max-w-md text-body text-text-secondary">{t("message")}</p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl border border-glass-border bg-glass px-6 py-3 text-body font-semibold text-text-primary transition-colors hover:bg-surface-elevated"
      >
        {t("retry")}
      </button>
    </main>
  );
}
