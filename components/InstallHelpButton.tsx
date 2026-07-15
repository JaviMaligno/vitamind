"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallHelpButton() {
  const t = useTranslations("install");
  const { isInstalled, isInAppBrowser, platform, trigger, detectionReady } = useInstallPrompt();

  // Wait for getInstalledRelatedApps() to resolve before rendering.
  // Avoids the flash where the button appears then disappears when the API
  // confirms the PWA is already installed (Chrome/Edge case).
  if (!detectionReady) return null;
  if (isInstalled) return null;
  // iOS Chrome/Firefox/Edge and unknown UAs: nothing useful to do, hide the button.
  if (platform === "unsupported" && !isInAppBrowser) return null;

  const label = t("help.button");

  return (
    <button
      type="button"
      onClick={() => { void trigger(); }}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-glass hover:text-text-primary transition-colors"
    >
      <Download className="h-5 w-5" aria-hidden />
    </button>
  );
}
