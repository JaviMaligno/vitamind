"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { getInstallBannerSeen, isStandalone, setInstallBannerSeen } from "@/lib/install";
import { loadPreferences } from "@/lib/storage";

export default function InstallBanner() {
  const t = useTranslations("install");
  const { platform, isInAppBrowser, isInstalled, trigger } = useInstallPrompt();
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInstalled || isStandalone()) return;
    if (getInstallBannerSeen()) return;

    const prefs = loadPreferences();
    if (!prefs.lastCityId || !prefs.skinType) return;

    const eligible =
      isInAppBrowser ||
      platform === "native" ||
      platform === "ios-manual" ||
      platform === "manual";
    if (!eligible) return;

    setInstallBannerSeen();
    setShouldRender(true);

    const showTimer = setTimeout(() => setVisible(true), 3000);
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
      <div className="mx-auto max-w-[960px] rounded-xl bg-text-primary text-bg-page-from shadow-2xl flex items-center gap-3 px-3 py-2.5">
        <span className="text-lg" aria-hidden>📲</span>
        <span className="flex-1 text-xs leading-tight">{t("banner.title")}</span>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-md bg-amber-400 text-text-primary font-bold text-xs hover:bg-amber-300 transition-colors"
        >
          {t("banner.cta")}
        </button>
        <button
          onClick={dismiss}
          aria-label={t("modal.close")}
          className="text-text-muted hover:text-text-primary px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
