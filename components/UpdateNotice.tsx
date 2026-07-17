"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpCircle } from "lucide-react";

export default function UpdateNotice() {
  const t = useTranslations("update");
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // When the app returns to the foreground, ask the browser to check for a
    // new service worker. A "warm" resume (the OS kept the app in memory and
    // the user just re-opens it) triggers no navigation and therefore no
    // automatic update check, so a long-lived install could otherwise sit on a
    // stale version indefinitely. This is event-driven — no background
    // polling; it fires a single conditional request only at the moment the
    // user re-opens the app, exactly when a new version matters.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && registration) {
        registration.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;
          // SW already waiting from a previous tab/session.
          if (reg.waiting && navigator.serviceWorker.controller) {
            setWaitingWorker(reg.waiting);
          }
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
              }
            });
          });
        })
        .catch((err) => {
          console.warn("SW registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!waitingWorker) return null;

  const reload = () => {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-2 right-2 top-2 z-50 mx-auto max-w-[480px] rounded-xl bg-amber-400 text-neutral-900 shadow-2xl flex items-center gap-3 px-3 py-2.5"
    >
      <ArrowUpCircle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1 text-xs font-semibold leading-tight">{t("available")}</span>
      <button
        type="button"
        onClick={reload}
        className="px-3 py-1.5 rounded-md bg-neutral-900 text-amber-300 font-bold text-xs hover:bg-neutral-800 transition-colors"
      >
        {t("reload")}
      </button>
    </div>
  );
}
