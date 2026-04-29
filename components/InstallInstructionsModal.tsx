"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { InstallPlatform } from "@/lib/install";

export type InstallModalMode = "banner" | "gating";

interface Props {
  open: boolean;
  mode: InstallModalMode;
  platform: InstallPlatform;
  isInAppBrowser: boolean;
  onClose: () => void;
}

export default function InstallInstructionsModal({ open, mode, platform, isInAppBrowser, onClose }: Props) {
  const t = useTranslations("install.modal");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const variant: "in-app" | "ios" | "fallback" =
    isInAppBrowser ? "in-app"
    : platform === "ios-manual" ? "ios"
    : "fallback";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — leave silent */ }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl bg-surface-elevated text-text-primary shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative px-6 pt-6 pb-3 text-center">
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-card hover:bg-surface-input flex items-center justify-center text-text-muted"
          >
            ✕
          </button>
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-white font-extrabold text-2xl font-[Playfair_Display,serif]">
            D
          </div>
          {variant === "in-app" && (
            <>
              <h3 className="text-lg font-bold mb-1">{t("inAppBrowser")}</h3>
              <p className="text-sm text-text-muted">{t("fallback")}</p>
            </>
          )}
          {variant === "ios" && (
            <>
              <h3 className="text-lg font-bold mb-1">
                {mode === "gating" ? t("iosBlock") : t("title")}
              </h3>
              <p className="text-sm text-text-muted">
                {mode === "gating" ? t("iosBlockSub") : t("subtitle")}
              </p>
            </>
          )}
          {variant === "fallback" && (
            <>
              <h3 className="text-lg font-bold mb-1">{t("title")}</h3>
              <p className="text-sm text-text-muted">{t("fallback")}</p>
            </>
          )}
        </div>

        {variant === "ios" && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-3 py-3 border-b border-border-subtle text-sm">
              <div className="w-6 h-6 rounded-full bg-text-primary text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">1</div>
              <div className="flex-1">{t("step1")}</div>
              <div className="px-2 py-1 rounded-md bg-surface-card border border-border-subtle text-blue-400 text-base">⬆︎</div>
            </div>
            <div className="flex items-center gap-3 py-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-text-primary text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">2</div>
              <div className="flex-1">{t("step2")}</div>
              <div className="px-2 py-1 rounded-md bg-surface-card border border-border-subtle text-base">⊞</div>
            </div>
          </div>
        )}

        {variant === "in-app" && (
          <div className="px-6 pb-4">
            <button
              onClick={handleCopyUrl}
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-text-primary font-semibold text-sm transition-colors"
            >
              {copied ? t("linkCopied") : t("copyUrl")}
            </button>
          </div>
        )}

        {variant === "ios" && (
          <div className="bg-surface-card px-6 py-3 text-center text-xs text-text-faint border-t border-border-subtle">
            {t("foot")}
          </div>
        )}
      </div>
    </div>
  );
}
