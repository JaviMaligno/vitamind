"use client";
import { useEffect } from "react";
import { useApp } from "@/context/AppProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";

/**
 * Neutral page background (cream by day, deep navy by night via the resolved
 * theme). The vibrant solar gradient is NOT a full-screen wash — it lives
 * contained in page heroes and accents. This component only keeps the neutral
 * canvas and feeds the live solar phase to the theme (so auto mode resolves
 * light/dark by the real sky).
 */
export default function SolarBackground({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { setAutoPhase } = useTheme();
  const livePhase = useSolarPhase(app.lat, app.lon);

  useEffect(() => {
    if (livePhase) setAutoPhase(livePhase);
  }, [livePhase, setAutoPhase]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-page-from via-bg-page-via to-bg-page-to text-text-primary font-sans pb-20">
      {children}
    </div>
  );
}
