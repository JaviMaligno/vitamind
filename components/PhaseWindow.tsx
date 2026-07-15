"use client";
import type { ReactNode } from "react";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

/**
 * A "window to the sky" data surface (like Card variant="window") whose dark fill
 * is TINTED by the live solar phase instead of a fixed navy — so the year strip
 * adapts to the moment of day like the rest of the page. The fill is a solid dark
 * phase colour (not the vibrant gradient), which keeps the faint on-window labels
 * legible and lets the heat-scale viz keep its contrast.
 *
 * Client island so the city page stays server-rendered; the year-strip SVG
 * (server-computed data) is passed as children unchanged.
 */
export default function PhaseWindow({
  lat,
  lon,
  className = "",
  children,
}: {
  lat: number;
  lon: number;
  className?: string;
  children: ReactNode;
}) {
  const phase = useSolarPhase(lat, lon) ?? "night";
  return (
    <div
      className={`rounded-2xl border border-window-border text-on-window shadow-lg ${className}`}
      style={{ background: PHASE_STYLE[phase].window }}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
