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
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    typeof window === "undefined" ? false : detectStandalone(),
  );
  const [inApp] = useState<boolean>(() =>
    typeof window === "undefined" ? false : detectInAppBrowser(),
  );
  const [modalMode, setModalMode] = useState<InstallModalMode | null>(null);
  const installedToastShown = useRef(false);

  // beforeinstallprompt listener
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // getInstalledRelatedApps: deterministic install detection on Chrome/Edge
  // (Android + desktop). Resolves the "user has the PWA installed but opened
  // the URL in a regular tab" case where matchMedia/navigator.standalone are
  // both false. Unsupported on iOS, Firefox, and Safari macOS — those keep
  // relying on the matchMedia/navigator.standalone fallback.
  useEffect(() => {
    type RelatedApp = { platform: string; url?: string; id?: string };
    const nav = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
    };
    if (typeof nav.getInstalledRelatedApps !== "function") return;
    nav.getInstalledRelatedApps()
      .then((apps) => {
        if (apps.length > 0) setIsInstalled(true);
      })
      .catch(() => { /* API present but call failed — silently ignore */ });
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
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.setAttribute("aria-atomic", "true");
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
