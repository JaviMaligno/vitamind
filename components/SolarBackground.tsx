"use client";
import { useEffect } from "react";
import { useApp } from "@/context/AppProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE, type SolarPhase } from "@/lib/solar-phase";

/**
 * Page canvas: a SOFT phase tint (not a vibrant wash) — cream-ish by dawn/day,
 * warm peach at dusk, deep navy at night. The vibrant gradient stays contained
 * in heroes/accents. Also feeds the live phase to the theme so auto mode
 * resolves light/dark by the real sky (only night is dark).
 */
export default function SolarBackground({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { theme, setAutoPhase } = useTheme();
  const livePhase = useSolarPhase(app.lat, app.lon);

  useEffect(() => {
    if (livePhase) setAutoPhase(livePhase);
  }, [livePhase, setAutoPhase]);

  // Manual override forces a representative phase; auto follows the live sky.
  const phase: SolarPhase =
    theme === "dark" ? "night" : theme === "light" ? "day" : (livePhase ?? "day");

  return (
    <div
      className="min-h-screen text-text-primary font-sans pb-20 transition-[background] duration-1000"
      style={{ background: PHASE_STYLE[phase].page }}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
