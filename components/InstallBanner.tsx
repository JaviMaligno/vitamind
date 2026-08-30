"use client";

import { useEffect, useRef, useState } from "react";
import { trackInstallBannerShown } from "@/lib/analytics";
import { useTranslations } from "next-intl";
import { Smartphone, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import {
  INSTALL_INTENT_EVENT,
  canShowInstallBanner,
  isStandalone,
  markInstallBannerOutcome,
  markInstallBannerShown,
  recordVisit,
} from "@/lib/install";
import PhaseButton from "@/components/PhaseButton";

export default function InstallBanner() {
  const t = useTranslations("install");
  const { platform, isInAppBrowser, isInstalled, trigger } = useInstallPrompt();
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * WHEN TO ASK. This used to be `setTimeout(…, 10000)`: ten seconds after the
   * page loaded, the banner appeared and the browser's one and only install
   * request was marked spent — usually on a sunrise table reached from Google,
   * by someone who had not yet been shown anything worth installing.
   *
   * Now the ask waits for a signal the visitor gave us: they came BACK (a
   * second session), or they touched a control that only someone using the
   * product touches (`INSTALL_INTENT_EVENT` — the skin selector, a month
   * expander, the GPS button). Time-on-page is not such a signal; a tab left
   * open in the background produces it for free.
   */
  useEffect(() => {
    if (isInstalled || isStandalone()) {
      queueMicrotask(() => setShouldRender(false));
      return;
    }
    if (!canShowInstallBanner()) return;

    const eligible =
      isInAppBrowser ||
      platform === "native" ||
      platform === "ios-manual" ||
      platform === "manual";
    if (!eligible) return;

    queueMicrotask(() => setShouldRender(true));

    // `recordVisit` is idempotent per session, so the effect re-running when
    // `beforeinstallprompt` finally fires does not inflate the count.
    const visits = recordVisit();

    const show = () => {
      // Marked here, at the moment it goes on screen, so "seen" means seen.
      markInstallBannerShown();
      trackInstallBannerShown(platform);
      setVisible(true);
    };

    if (visits >= 2) {
      show();
      return;
    }

    const onIntent = () => show();
    window.addEventListener(INSTALL_INTENT_EVENT, onIntent, { once: true });
    return () => window.removeEventListener(INSTALL_INTENT_EVENT, onIntent);
  }, [platform, isInAppBrowser, isInstalled]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, []);

  if (!shouldRender) return null;

  const dismiss = (outcome?: "dismissed") => {
    if (outcome) markInstallBannerOutcome(outcome);
    setClosing(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setShouldRender(false);
      dismissTimerRef.current = null;
    }, 250);
  };

  const handleInstall = async () => {
    const result = await trigger();
    // `accepted` is the native prompt's own verdict. `manual` means the
    // instructions modal took over — that is engagement, not a refusal, and the
    // modal records its own display, so no outcome is written here.
    if (result === "accepted") markInstallBannerOutcome("installed");
    else if (result === "dismissed") markInstallBannerOutcome("dismissed");
    dismiss();
  };

  return (
    <div
      className={`fixed left-2 right-2 z-40 transition-all duration-300 ${
        visible && !closing
          ? "bottom-[68px] opacity-100 translate-y-0"
          : "bottom-[40px] opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="mx-auto max-w-[960px] rounded-xl bg-neutral-900 text-white shadow-2xl flex items-center gap-3 px-3 py-2.5">
        <Smartphone className="h-5 w-5 shrink-0" aria-hidden />
        <span className="flex-1 text-xs leading-tight">{t("banner.title")}</span>
        <PhaseButton compact onClick={handleInstall}>
          {t("banner.cta")}
        </PhaseButton>
        <button
          onClick={() => dismiss("dismissed")}
          aria-label={t("modal.close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
