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
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
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
