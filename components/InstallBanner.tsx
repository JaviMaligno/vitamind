"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Smartphone, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { getInstallBannerSeen, isStandalone, setInstallBannerSeen } from "@/lib/install";
import PhaseButton from "@/components/PhaseButton";

export default function InstallBanner() {
  const t = useTranslations("install");
  const { platform, isInAppBrowser, isInstalled, trigger } = useInstallPrompt();
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInstalled || isStandalone()) {
      queueMicrotask(() => setShouldRender(false));
      return;
    }
    if (getInstallBannerSeen()) {
      // Already shown once. Don't auto-show again. (We only set this state on first mount.)
      return;
    }

    const eligible =
      isInAppBrowser ||
      platform === "native" ||
      platform === "ios-manual" ||
      platform === "manual";
    if (!eligible) return;

    queueMicrotask(() => setShouldRender(true));

    const showTimer = setTimeout(() => {
      setInstallBannerSeen();
      setVisible(true);
    }, 10000);
    return () => clearTimeout(showTimer);
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

  const dismiss = () => {
    setClosing(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setShouldRender(false);
      dismissTimerRef.current = null;
    }, 250);
  };

  const handleInstall = async () => {
    await trigger();
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
          onClick={dismiss}
          aria-label={t("modal.close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
