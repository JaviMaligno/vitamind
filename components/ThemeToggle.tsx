"use client";
import { SunMoon, Sun, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/context/ThemeProvider";

/**
 * Theme control. It cycles auto → light → dark, so — unlike a bare icon, which
 * reads as a binary switch — it shows the CURRENT mode as a label next to the
 * icon (SunMoon = auto/follows the sun, Sun = light, Moon = dark). First render
 * is always "auto" (matching the provider's SSR default), so no hydration jump.
 *
 * The label is desktop-only: on a signed-in mobile header (install + theme +
 * language + sign-out) it was the ~30px that pushed the brand into an ellipsis.
 * The icon still differs per state, and title/aria-label keep the full label.
 */
export default function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const t = useTranslations("theme");
  const modeLabel = theme === "auto" ? t("auto") : theme === "light" ? t("light") : t("dark");
  const Icon = theme === "auto" ? SunMoon : theme === "light" ? Sun : Moon;
  const label = `${t("label")}: ${modeLabel}`;

  return (
    <button
      onClick={cycle}
      className="flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-glass border border-glass-border px-2.5 text-text-secondary hover:text-text-primary transition-colors"
      aria-label={label}
      title={label}
      suppressHydrationWarning
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden suppressHydrationWarning />
      <span className="hidden sm:inline text-caption font-medium" suppressHydrationWarning>{modeLabel}</span>
    </button>
  );
}
