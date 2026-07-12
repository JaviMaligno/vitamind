"use client";
import { useEffect } from "react";
import { useApp } from "@/context/AppProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE, type SolarPhase } from "@/lib/solar-phase";

export default function SolarBackground({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { theme, setAutoPhase } = useTheme();
  const livePhase = useSolarPhase(app.lat, app.lon);

  useEffect(() => {
    if (livePhase) setAutoPhase(livePhase);
  }, [livePhase, setAutoPhase]);

  const phase: SolarPhase =
    theme === "dark" ? "night" : theme === "light" ? "day" : (livePhase ?? "day");
  const grad = PHASE_STYLE[phase].grad;

  return (
    <div
      className="min-h-screen text-text-primary font-sans pb-20 transition-[background] duration-1000"
      style={{ background: grad }}
    >
      {children}
    </div>
  );
}
