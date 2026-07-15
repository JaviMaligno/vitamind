"use client";
import type { ReactNode } from "react";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

type Tone = "possible" | "winter";

/**
 * EXPLORATORY / BOLD variant of the city hero (calibration for the redesign —
 * see docs/superpowers). Full-bleed, poster-scale sky with the verdict as a
 * giant editorial statement instead of a small badge in a glass card.
 *
 * Does not replace CityHero.tsx (other pages still use the contained version);
 * this is a standalone component used only by the city page for this exploration.
 *
 * Colour on the giant stat/verdict is hardcoded (not the --color-possible /
 * --color-winter tokens) because those tokens flip between a light and dark
 * value depending on the SITE theme, but this hero is always a dark "poster"
 * surface (vibrant gradient + dark scrim) regardless of light/dark mode.
 */
export default function CityHeroBold({
  lat,
  lon,
  eyebrow,
  title,
  tone,
  statPhrase,
  verdict,
  impossibleText,
  exactWindowLabel,
  dateRange,
  notifyLead,
  notify,
}: {
  lat: number;
  lon: number;
  eyebrow: string;
  title: string;
  tone: Tone;
  statPhrase: string;
  verdict: string;
  impossibleText?: string | null;
  exactWindowLabel?: string;
  dateRange?: string | null;
  notifyLead: string;
  notify: ReactNode;
}) {
  const phase = useSolarPhase(lat, lon) ?? "day";
  // "possible" green integrates with each phase (neon only at night); "winter"
  // stays a neutral grey. See --stat-{phase} in globals.
  const statColor = tone === "possible" ? PHASE_STYLE[phase].stat : "#cbd5e1";

  return (
    <section className="relative isolate flex flex-col justify-end overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[440px] sm:min-h-[560px] lg:min-h-[600px]">
      {/* the sky */}
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />

      {/* poster-scale earthrise: planet limb + sun, much bigger than the contained hero */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="bold-limb" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.03" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
          <radialGradient id="bold-sun">
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset="0.3" stopColor="white" stopOpacity="0.6" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {phase === "night" && (
          <g fill="white" opacity="0.5">
            <circle cx="120" cy="110" r="1.6" />
            <circle cx="260" cy="60" r="1.2" />
            <circle cx="410" cy="150" r="1.8" />
            <circle cx="560" cy="70" r="1.3" />
            <circle cx="90" cy="230" r="1.4" />
            <circle cx="1080" cy="90" r="1.6" />
            <circle cx="960" cy="40" r="1.2" />
            <circle cx="1140" cy="200" r="1.4" />
            <circle cx="700" cy="30" r="1.1" />
            <circle cx="820" cy="90" r="1.5" />
          </g>
        )}

        {/* atmospheric glow along the limb */}
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="60" />
        {/* the planet's edge */}
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="url(#bold-limb)" strokeWidth="3" />
        {/* extra ring for scale/drama */}
        <circle cx="900" cy="250" r="190" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1.5" />
        {/* the sun: a bright diamond on the ring, much bigger */}
        <circle cx="900" cy="250" r="120" fill="url(#bold-sun)" />
        <circle cx="900" cy="250" r="15" fill="white" />
      </svg>

      {/* legibility scrim: transparent up top (sun stays vivid), dark toward the
          content that sits at the bottom */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(190deg, rgba(6,8,20,0.05) 0%, rgba(6,8,20,0.24) 42%, rgba(6,8,20,0.8) 100%)" }}
        aria-hidden
      />

      {/* content, anchored to the bottom like a poster */}
      <div className="relative z-10 flex flex-col gap-5 p-6 sm:p-10 lg:p-14">
        <p className="text-caption sm:text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
          {eyebrow}
        </p>

        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-7xl leading-[1.02] tracking-tight text-white max-w-3xl [text-shadow:0_2px_24px_rgba(0,0,0,0.4)]">
          {title}
        </h1>

        <div>
          <p
            className="font-display font-black text-5xl sm:text-6xl md:text-8xl leading-[0.95] [text-shadow:0_2px_28px_rgba(0,0,0,0.45)]"
            style={{ color: statColor }}
          >
            {statPhrase}
          </p>
          <p className="mt-2 text-lg sm:text-xl md:text-2xl text-white max-w-2xl [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]">
            {verdict}
          </p>
          {impossibleText && (
            <p className="mt-2 text-body sm:text-lg text-white/80 max-w-2xl [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">{impossibleText}</p>
          )}
        </div>

        {dateRange && (
          <div>
            <div className="text-caption sm:text-sm uppercase tracking-wide text-white/70">{exactWindowLabel}</div>
            <div className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-white">{dateRange}</div>
          </div>
        )}

        <div className="inline-flex w-fit max-w-full flex-col gap-3 rounded-2xl border border-white/15 bg-black/25 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-body text-white/90">{notifyLead}</p>
          {notify}
        </div>
      </div>
    </section>
  );
}
