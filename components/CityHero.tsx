"use client";
import Card from "@/components/ui/Card";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";
import type { ReactNode } from "react";

/** Contained hero: the city's live sky (phase gradient) as a rounded band with an
 *  "earthrise" — the planet's limb glow crossing the band and the sun as a bright
 *  diamond on the ring — and the headline content in a glass card on top. */
export default function CityHero({
  lat, lon, children,
}: { lat: number; lon: number; children: ReactNode }) {
  const phase = useSolarPhase(lat, lon) ?? "day";
  return (
    <section className="relative rounded-3xl overflow-hidden p-5 sm:p-8">
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 380"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="limb" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.04" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.45" />
            <stop offset="1" stopColor="white" stopOpacity="0.04" />
          </linearGradient>
          <radialGradient id="sun">
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset="0.35" stopColor="white" stopOpacity="0.55" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* atmospheric glow along the limb */}
        <path d="M-40,380 Q600,70 1240,380" fill="none" stroke="white" strokeOpacity="0.09" strokeWidth="28" />
        {/* the planet's edge */}
        <path d="M-40,380 Q600,70 1240,380" fill="none" stroke="url(#limb)" strokeWidth="2.5" />
        {/* the sun: a bright diamond on the ring */}
        <circle cx="965" cy="158" r="60" fill="url(#sun)" />
        <circle cx="965" cy="158" r="6" fill="white" />
      </svg>
      <div className="relative">
        <Card variant="glass" className="max-w-2xl">
          {children}
        </Card>
      </div>
    </section>
  );
}
