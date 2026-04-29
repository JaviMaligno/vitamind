"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  detectPlatform,
  isInAppBrowser as detectInAppBrowser,
  isStandalone as detectStandalone,
  setInstallBannerSeen,
  type InstallPlatform,
} from "@/lib/install";
import InstallInstructionsModal, { type InstallModalMode } from "@/components/InstallInstructionsModal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallContextValue {
  platform: InstallPlatform;
  isInstalled: boolean;
  isInAppBrowser: boolean;
  trigger: () => Promise<"accepted" | "dismissed" | "manual">;
  openModal: (mode: InstallModalMode) => void;
}

const InstallContext = createContext<InstallContextValue | null>(null);

export function useInstallContext(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error("useInstallContext must be used inside InstallProvider");
  return ctx;
}

export default function InstallProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("install");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [modalMode, setModalMode] = useState<InstallModalMode | null>(null);
  const installedToastShown = useRef(false);

  // Detect static state on mount
  useEffect(() => {
    setIsInstalled(detectStandalone());
    setInApp(detectInAppBrowser());
  }, []);

  // beforeinstallprompt listener
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // appinstalled listener
  useEffect(() => {
    const onInstalled = () => {
      setInstallBannerSeen();
      setDeferredPrompt(null);
      setIsInstalled(true);
      if (!installedToastShown.current) {
        installedToastShown.current = true;
        // Lightweight toast: fixed bottom, auto-dismiss after 4s
        const toast = document.createElement("div");
        toast.textContent = t("installed.toast");
        toast.className = "fixed left-1/2 -translate-x-1/2 bottom-24 z-[110] px-4 py-2.5 rounded-xl bg-amber-400 text-text-primary font-semibold text-sm shadow-2xl";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [t]);

  const platform = useMemo<InstallPlatform>(
    () => detectPlatform(deferredPrompt),
    [deferredPrompt],
  );

  const openModal = useCallback((mode: InstallModalMode) => {
    setInstallBannerSeen();
    setModalMode(mode);
  }, []);

  const closeModal = useCallback(() => setModalMode(null), []);

  const trigger = useCallback(async (): Promise<"accepted" | "dismissed" | "manual"> => {
    if (inApp) {
      openModal("banner");
      return "manual";
    }
    if (platform === "native" && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        return outcome;
      } catch {
        setDeferredPrompt(null);
        return "dismissed";
      }
    }
    if (platform === "ios-manual" || platform === "manual") {
      openModal("banner");
      return "manual";
    }
    return "manual";
  }, [inApp, platform, deferredPrompt, openModal]);

  const value: InstallContextValue = useMemo(
    () => ({ platform, isInstalled, isInAppBrowser: inApp, trigger, openModal }),
    [platform, isInstalled, inApp, trigger, openModal],
  );

  return (
    <InstallContext.Provider value={value}>
      {children}
      <InstallInstructionsModal
        open={modalMode !== null}
        mode={modalMode ?? "banner"}
        platform={platform}
        isInAppBrowser={inApp}
        onClose={closeModal}
      />
    </InstallContext.Provider>
  );
}
