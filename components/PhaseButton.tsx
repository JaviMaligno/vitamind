"use client";
import type { ReactNode } from "react";
import { useApp } from "@/context/AppProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

/**
 * Canonical primary CTA. Its fill adapts to the live solar phase
 * (--cta-{phase}: raspberry / blue / magenta / violet) instead of a fixed
 * colour — matching the city-hero CTA (see CityCta) so every primary action
 * across the app shares one language. Reads the phase from the user's stored
 * location (useApp), so it works on pages without their own lat/lon (Partners,
 * install prompts). Renders an <a> when `href` is set (e.g. mailto), else a
 * <button>. Client island; safe inside any AppProvider-wrapped page.
 */
export default function PhaseButton({
  href,
  onClick,
  target,
  rel,
  type = "button",
  compact = false,
  className = "",
  children,
  "aria-label": ariaLabel,
}: {
  href?: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  compact?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const app = useApp();
  const phase = useSolarPhase(app.lat, app.lon) ?? "day";
  const size = compact ? "min-h-[36px] px-3 text-caption gap-1.5" : "min-h-[48px] px-6 text-body gap-2";
  const cls =
    `inline-flex items-center justify-center ${size} rounded-xl font-semibold text-white shadow-lg transition-[filter] hover:brightness-110 cursor-pointer ` +
    className;
  const style = { background: PHASE_STYLE[phase].cta };

  if (href) {
    return (
      <a href={href} target={target} rel={rel} aria-label={ariaLabel} className={cls} style={style} suppressHydrationWarning>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} aria-label={ariaLabel} className={cls} style={style} suppressHydrationWarning>
      {children}
    </button>
  );
}
