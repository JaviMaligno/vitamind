"use client";

import { useTranslations } from "next-intl";
import { WifiOff, RefreshCw } from "lucide-react";

/**
 * Offline fallback (served by the service worker when a page fetch fails). It
 * renders inside the normal app shell, so instead of the old full-screen navy
 * takeover — which read as an accidental dark box between the light header and
 * footer — it's a centred notice on the live phase background, in the system's
 * dark "window" surface. Styling uses cached Tailwind tokens (the CSS is
 * precached by the SW), so it holds up with no network.
 */
export default function OfflinePage() {
  const t = useTranslations("offline");

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[560px] items-center justify-center px-4 py-10">
      <div className="w-full rounded-[2rem] border border-window-border bg-window px-6 py-10 text-center shadow-lg sm:px-10">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-on-window">
          <WifiOff className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="font-display text-title font-bold text-on-window">
          {t("title")}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-body leading-relaxed text-on-window-faint">
          {t("description")}
        </p>
        <button
          type="button"
          onClick={() => typeof window !== "undefined" && window.location.reload()}
          className="mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white/12 px-7 text-body font-semibold text-on-window transition-colors hover:bg-white/20"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
