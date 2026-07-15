"use client";
import { useApp } from "@/context/AppProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

/**
 * BOLD poster hero for the city index (the directory landing). Same poster
 * language as CityHeroBold — full-bleed phase gradient + big earthrise + dark
 * scrim, content anchored bottom — but the giant focal figure is the SIZE of
 * the directory (how many cities) instead of a single city's verdict.
 *
 * Client island: it reads the user's location (app.lat/lon) so its sky matches
 * the live page background (SolarBackground). The city LIST stays server-
 * rendered in page.tsx, so SEO/JSON-LD/static params are unaffected.
 *
 * The giant figure colour is hardcoded (not the semantic tokens) because this
 * hero is always a dark poster surface regardless of light/dark theme, exactly
 * like CityHeroBold.
 */
export default function IndexHeroBold({
  eyebrow,
  title,
  intro,
  count,
  countLabel,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  count: number;
  countLabel: string;
}) {
  const app = useApp();
  const phase = useSolarPhase(app.lat, app.lon) ?? "day";

  return (
    <section className="relative isolate flex flex-col justify-end overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[360px] sm:min-h-[440px] lg:min-h-[500px]">
      {/* the sky */}
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />

      {/* poster-scale earthrise: planet limb + sun (same language as CityHeroBold) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="index-limb" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.03" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
          <radialGradient id="index-sun">
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
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="url(#index-limb)" strokeWidth="3" />
        {/* extra ring for scale/drama */}
        <circle cx="900" cy="250" r="190" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1.5" />
        {/* the sun: a bright diamond on the ring */}
        <circle cx="900" cy="250" r="120" fill="url(#index-sun)" />
        <circle cx="900" cy="250" r="15" fill="white" />
      </svg>

      {/* legibility scrim */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(190deg, rgba(6,8,20,0.05) 0%, rgba(6,8,20,0.24) 42%, rgba(6,8,20,0.8) 100%)" }}
        aria-hidden
      />

      {/* content, anchored to the bottom like a poster (the section itself is the
          flex-col justify-end container — a child h-full/justify-end wouldn't
          resolve against the section's min-height, leaving a void below). */}
      <div className="relative z-10 flex flex-col gap-5 p-6 sm:p-10 lg:p-14">
        <p className="text-caption sm:text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          {eyebrow}
        </p>

        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-7xl leading-[1.02] tracking-tight text-white max-w-3xl [text-shadow:0_2px_24px_rgba(0,0,0,0.4)]">
          {title}
        </h1>

        <div className="flex items-end gap-4">
          <p
            className="font-display font-black text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.45)]"
          >
            {count}
          </p>
          <p className="mb-2 text-lg sm:text-xl md:text-2xl font-semibold uppercase tracking-wide text-white/80">
            {countLabel}
          </p>
        </div>

        <p className="text-lg sm:text-xl text-white/90 max-w-2xl [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
          {intro}
        </p>
      </div>
    </section>
  );
}
