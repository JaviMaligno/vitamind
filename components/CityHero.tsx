"use client";
import Card from "@/components/ui/Card";
import { SunArc } from "@/components/ui/Icon";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";
import type { ReactNode } from "react";

/** Contained hero: the city's live sky (phase gradient) as a rounded band, with
 *  the headline content in a glass card on top so text stays legible. */
export default function CityHero({
  lat, lon, children,
}: { lat: number; lon: number; children: ReactNode }) {
  const phase = useSolarPhase(lat, lon) ?? "day";
  return (
    <section className="relative rounded-3xl overflow-hidden p-5 sm:p-8">
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />
      <SunArc className="pointer-events-none absolute -top-8 right-6 h-44 w-44 text-white/25" aria-hidden />
      <div className="relative">
        <Card variant="glass" className="max-w-2xl">
          {children}
        </Card>
      </div>
    </section>
  );
}
