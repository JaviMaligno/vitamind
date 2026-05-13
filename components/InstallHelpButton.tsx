"use client";

import { useTranslations } from "next-intl";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallHelpButton() {
  const t = useTranslations("install");
  const { isInstalled, isInAppBrowser, platform, trigger } = useInstallPrompt();

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
      className="text-lg leading-none hover:opacity-80 transition-opacity"
    >
      <span aria-hidden>📲</span>
    </button>
  );
}
