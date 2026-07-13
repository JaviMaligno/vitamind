"use client";
import { useApp } from "@/context/AppProvider";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";

/**
 * BOLD poster hero for the Learn page. Text-only poster (phase gradient +
 * earthrise + scrim, content anchored bottom), matching the rest of the
 * redesign. A small client island so the Learn page itself stays a server
 * component (its FAQ content ships in the static HTML for SEO); this only
 * reads the user's location so its sky matches the live page background.
 */
export default function LearnHeroBold({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const app = useApp();
  const phase = useSolarPhase(app.lat, app.lon) ?? "day";

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[260px] sm:min-h-[340px]">
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="learn-limb" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.03" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
          <radialGradient id="learn-sun">
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
            <circle cx="1080" cy="90" r="1.6" />
            <circle cx="960" cy="40" r="1.2" />
            <circle cx="1140" cy="200" r="1.4" />
            <circle cx="820" cy="90" r="1.5" />
          </g>
        )}

        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="60" />
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="url(#learn-limb)" strokeWidth="3" />
        <circle cx="960" cy="230" r="150" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1.5" />
        <circle cx="960" cy="230" r="95" fill="url(#learn-sun)" />
        <circle cx="960" cy="230" r="12" fill="white" />
      </svg>

      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(190deg, rgba(6,8,20,0.05) 0%, rgba(6,8,20,0.16) 45%, rgba(6,8,20,0.6) 100%)" }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-6 sm:p-10">
        <p className="text-caption sm:text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          {eyebrow}
        </p>
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.4)]">
          {title}
        </h1>
        <p className="text-lg sm:text-xl text-white/90 max-w-2xl [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
