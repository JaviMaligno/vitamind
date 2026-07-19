"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpCircle } from "lucide-react";

// Ask a service worker which build it ships (sw.js replies to GET_VERSION
// with its stamped build version). Resolves null if the worker doesn't answer
// within the timeout — e.g. a worker from a deploy that predates the
// handshake — so callers fall back to showing the notice.
function getWorkerVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      const version = (event.data as { version?: unknown } | null)?.version;
      resolve(typeof version === "string" ? version : null);
    };
    worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
  });
}

export default function UpdateNotice() {
  const t = useTranslations("update");
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    let disposed = false;
    let silentActivations = 0;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      // A silent activation swapped in a SW for the build this page already
      // runs — there is nothing newer to reload onto.
      if (silentActivations > 0) {
        silentActivations -= 1;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Pages are served network-first, so a normal online (re)load already
    // delivers the newest build — by the time the browser parks the new SW in
    // "waiting", this document usually IS that build, and asking the user to
    // "reload for the new version" would be noise. Compare builds and only
    // show the notice when the running page is actually older than the
    // waiting worker (warm PWA resume, long-lived tab, offline cache
    // fallback). On a match, activate the worker silently instead. A page
    // with no version of its own predates this handshake and is stale by
    // definition, so it keeps the notice.
    const handleWaiting = (worker: ServiceWorker) => {
      const appVersion = process.env.NEXT_PUBLIC_BUILD_VERSION;
      if (!appVersion) {
        setWaitingWorker(worker);
        return;
      }
      getWorkerVersion(worker).then((swVersion) => {
        if (disposed) return;
        if (swVersion === appVersion) {
          silentActivations += 1;
          worker.postMessage({ type: "SKIP_WAITING" });
          return;
        }
        setWaitingWorker(worker);
      });
    };

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
            handleWaiting(reg.waiting);
          }
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                handleWaiting(newWorker);
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
      disposed = true;
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
