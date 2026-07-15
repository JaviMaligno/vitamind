"use client";

import { useTranslations, useLocale } from "next-intl";
import type { NowStatus } from "@/lib/types";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";
import Flag from "@/components/ui/Flag";
import { formatCountdown, fmtMin, getStatusKey, type StatusKey } from "./day-status";

/**
 * BOLD poster hero for "My Day" — same poster language as CityHeroBold (full-
 * bleed phase gradient + big earthrise + dark scrim, content anchored bottom),
 * but the giant focal is today's live status headline instead of a city's
 * verdict. Always a dark poster surface, so colours are hardcoded (bright dot
 * per status + white headline) rather than the light/dark-flipping tokens.
 *
 * Replaces the contained CityHero + DayRecommendation pairing on the dashboard.
 */

// Dot colour per status, tuned to read on the dark poster. (optimal is
// overridden per-phase in the component; this value is just a fallback.)
const DOT: Record<StatusKey, string> = {
  optimal: "#5fd39b",
  moderate: "#fbbf24",
  upcoming: "#60a5fa",
  windowClosed: "#cbd5e1",
  insufficient: "#f87171",
};

interface Props {
  nowStatus: NowStatus;
  cityName: string;
  cityFlag: string;
  targetIU: number;
  loading: boolean;
  lat: number;
  lon: number;
}

export default function DayHeroBold({ nowStatus, cityName, cityFlag, targetIU, loading, lat, lon }: Props) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const phase = useSolarPhase(lat, lon) ?? "day";
  const ns = nowStatus;

  const statusKey = getStatusKey(ns);
  // "optimal" green follows the phase (mint by day, neon at night) so it stops
  // reading as neon against the warm/light gradients; other states keep their hue.
  const dot = statusKey === "optimal" ? PHASE_STYLE[phase].stat : DOT[statusKey];
  const todayStr = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  // The giant headline copy, per state.
  let headline = "";
  let hint: string | null = null;
  if (ns.state === "good_now" && ns.intensity === "optimal") {
    headline = t("nowOptimalTitle");
    hint = t("nowOptimalHint");
  } else if (ns.state === "good_now" && ns.intensity === "moderate") {
    headline = t("nowModerateTitle");
    hint = t("nowModerateHint");
  } else if (ns.state === "upcoming") {
    headline = t("nowUpcomingTitle", { countdown: formatCountdown(ns.minutesUntilWindow ?? 0), hour: `${ns.window?.start ?? 0}:00` });
    hint = ns.cloudDegraded ? t("cloudDegraded") : null;
  } else if (ns.state === "window_closed") {
    headline = t("nowClosedTitle", { hour: `${ns.window?.end ?? 0}:00` });
    hint = t("nowClosedHint");
  } else {
    headline = t("noWindowToday");
    hint = ns.cloudDegraded ? t("cloudDegradedFull") : t("noWindowHint");
  }

  const showData = ns.state === "good_now" || ns.state === "upcoming";

  return (
    <section className="relative isolate flex flex-col justify-end overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[440px] sm:min-h-[540px]">
      {/* the sky */}
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />

      {/* poster-scale earthrise (same language as CityHeroBold) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="day-limb" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.03" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
          <radialGradient id="day-sun">
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

        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="60" />
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="url(#day-limb)" strokeWidth="3" />
        <circle cx="900" cy="250" r="190" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1.5" />
        <circle cx="900" cy="250" r="120" fill="url(#day-sun)" />
        <circle cx="900" cy="250" r="15" fill="white" />
      </svg>

      {/* legibility scrim */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(190deg, rgba(6,8,20,0.05) 0%, rgba(6,8,20,0.24) 42%, rgba(6,8,20,0.8) 100%)" }}
        aria-hidden
      />

      {/* content, anchored to the bottom like a poster */}
      <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-10 lg:p-14">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-40 rounded bg-white/20" />
            <div className="h-16 w-3/4 rounded bg-white/20" />
            <div className="h-5 w-1/2 rounded bg-white/15" />
          </div>
        ) : (
          <>
            {/* city + date */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body font-semibold text-white/90"><Flag flag={cityFlag} className="text-body" /> {cityName}</span>
              <span className="text-caption sm:text-sm text-white/60">{todayStr}</span>
            </div>

            {/* status pill */}
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
              <span className="text-caption sm:text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: dot }}>
                {t(`now_${statusKey}`)}
              </span>
            </div>

            {/* GIANT status headline */}
            <h1 className="font-display font-black text-3xl sm:text-4xl md:text-6xl leading-[1.02] tracking-tight text-white max-w-3xl [text-shadow:0_2px_28px_rgba(0,0,0,0.45)]">
              {headline}
            </h1>

            {hint && (
              <p className="text-lg sm:text-xl text-white/85 max-w-2xl [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
                {hint}
              </p>
            )}

            {/* data row */}
            {showData && (
              <div className="mt-1 flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <span className="block text-caption uppercase tracking-wider text-white/55">{t("currentUVI")}</span>
                  <span className="font-mono text-xl font-semibold text-white">{ns.effectiveUVI.toFixed(1)}</span>
                </div>
                {ns.window && (
                  <div>
                    <span className="block text-caption uppercase tracking-wider text-white/55">{t("nowWindow")}</span>
                    <span className="text-xl text-white/90">{ns.window.start}:00 – {ns.window.end}:00</span>
                  </div>
                )}
                {ns.state === "good_now" && ns.minutesNeeded !== null && (
                  <div>
                    <span className="block text-caption uppercase tracking-wider text-white/55">{t("nowTimeNeeded")}</span>
                    <span className="font-mono text-xl font-semibold" style={{ color: PHASE_STYLE[phase].stat }}>{fmtMin(ns.minutesNeeded)}</span>
                    <span className="ml-1 text-caption text-white/50">{t("forIU", { iu: targetIU })}</span>
                  </div>
                )}
                {ns.state === "good_now" && ns.windowClosesIn !== null && (
                  <div>
                    <span className="block text-caption uppercase tracking-wider text-white/55">{t("nowClosesIn")}</span>
                    <span className="text-xl text-white/90">{formatCountdown(ns.windowClosesIn)}</span>
                  </div>
                )}
                {ns.state === "upcoming" && ns.bestHour !== null && ns.bestMinutes !== null && (
                  <div>
                    <span className="block text-caption uppercase tracking-wider text-white/55">{t("nowBestHour")}</span>
                    <span className="text-xl text-white/90">{fmtMin(ns.bestMinutes)} {t("atHour", { hour: `${ns.bestHour}:00` })}</span>
                    <span className="ml-1 text-caption text-white/50">{t("forIU", { iu: targetIU })}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
