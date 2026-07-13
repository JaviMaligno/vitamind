"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CitySearch from "@/components/CitySearch";
import GpsErrorHint from "@/components/GpsErrorHint";
import PartnerBadge from "@/components/PartnerBadge";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";
import type { City, NowStatus } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  doy: number;
  canSynthesize: boolean;
  nowStatus?: NowStatus | null;
  cityName: string;
  cityFlag: string;
  hasLocation: boolean;
  onSelectCity: (c: City) => void;
  onAddFav: (c: City | string) => void;
  favorites: string[];
  allCities: City[];
  peakElevation: number;
  dateLabel: string;
  targetIU: number;
  onRequestGps?: () => void;
  gpsLoading?: boolean;
  gpsSlow?: boolean;
  gpsError?: "gpsDenied" | "gpsTimeout" | "gpsUnavailable" | "gpsGenericError" | "gpsNotSupported" | null;
}

function formatCountdown(totalMinutes: number): string {
  if (totalMinutes < 1) return "<1 min";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const GpsPin = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path
      fillRule="evenodd"
      d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * BOLD poster hero for Explore — same poster language as the other bold heroes
 * (phase gradient + earthrise + dark scrim, content anchored bottom), showing
 * the explorer's current place/date and its synthesis status as the giant
 * focal. Ports HeroZone's five-state + GPS logic; replaces it (Explore-only).
 */
export default function ExploreHeroBold({
  lat,
  lon,
  canSynthesize,
  nowStatus,
  cityName,
  cityFlag,
  hasLocation,
  onSelectCity,
  onAddFav,
  favorites,
  allCities,
  peakElevation,
  dateLabel,
  targetIU,
  onRequestGps,
  gpsLoading,
  gpsSlow,
  gpsError,
}: Props) {
  const t = useTranslations("hero");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const phase = useSolarPhase(lat, lon) ?? "day";

  type Mode = "good_now" | "upcoming" | "window_closed" | "no_synthesis" | "day_possible" | "day_impossible";
  const mode: Mode = nowStatus ? nowStatus.state : canSynthesize ? "day_possible" : "day_impossible";
  const positive = mode === "good_now" || mode === "day_possible";
  const muted = mode === "upcoming" || mode === "window_closed";
  const dot = positive ? "#4ade80" : muted ? "#cbd5e1" : "#f87171";

  const statusLabel = (() => {
    if (mode === "good_now") return t("synthesisPossible");
    if (mode === "upcoming") return td("now_upcoming");
    if (mode === "window_closed") return td("now_windowClosed");
    if (mode === "no_synthesis" || mode === "day_impossible") return t("noSynthesis");
    return t("synthesisPossible");
  })();

  // Per-mode giant headline + optional hint.
  let headline = "";
  let hint: string | null = null;
  if (mode === "good_now" || mode === "day_possible") {
    headline = t("synthesisPossible");
    hint = t("forVitDDynamic", { iu: targetIU });
  } else if (mode === "upcoming") {
    headline = td("nowUpcomingTitle", {
      countdown: formatCountdown(nowStatus?.minutesUntilWindow ?? 0),
      hour: `${nowStatus?.window?.start ?? 0}:00`,
    });
    hint = nowStatus?.cloudDegraded ? td("cloudDegraded") : null;
  } else if (mode === "window_closed") {
    headline = td("nowClosedTitle", { hour: `${nowStatus?.window?.end ?? 0}:00` });
    hint = td("nowClosedHint");
  } else {
    headline = t("noSynthesisTitle");
    hint = t("noSynthesisHint");
  }

  const showDetails = mode === "good_now" || mode === "upcoming" || mode === "window_closed" || mode === "day_possible";

  // Shared poster chrome (sky + earthrise + scrim).
  const Sky = (
    <>
      <div className="absolute inset-0" style={{ background: PHASE_STYLE[phase].grad }} suppressHydrationWarning aria-hidden />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="explore-limb" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.03" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
          <radialGradient id="explore-sun">
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset="0.3" stopColor="white" stopOpacity="0.6" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        {phase === "night" && (
          <g fill="white" opacity="0.5">
            <circle cx="120" cy="110" r="1.6" /><circle cx="260" cy="60" r="1.2" /><circle cx="410" cy="150" r="1.8" />
            <circle cx="560" cy="70" r="1.3" /><circle cx="1080" cy="90" r="1.6" /><circle cx="960" cy="40" r="1.2" />
            <circle cx="1140" cy="200" r="1.4" /><circle cx="820" cy="90" r="1.5" />
          </g>
        )}
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="60" />
        <path d="M-80,700 Q600,120 1280,700" fill="none" stroke="url(#explore-limb)" strokeWidth="3" />
        <circle cx="900" cy="250" r="190" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1.5" />
        <circle cx="900" cy="250" r="120" fill="url(#explore-sun)" />
        <circle cx="900" cy="250" r="15" fill="white" />
      </svg>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(190deg, rgba(6,8,20,0.06) 0%, rgba(6,8,20,0.18) 40%, rgba(6,8,20,0.68) 100%)" }}
        aria-hidden
      />
    </>
  );

  // No-location: a poster with the search/GPS entry.
  if (!hasLocation) {
    return (
      <section className="relative isolate overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[420px] sm:min-h-[500px]">
        {Sky}
        <div className="relative z-10 flex h-full flex-col justify-end gap-5 p-6 sm:p-10 lg:p-14">
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.4)]">
            {t("whereAreYou")}
          </h1>
          <p className="text-lg sm:text-xl text-white/85 max-w-2xl [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">{t("searchHint")}</p>
          {onRequestGps && (
            <div>
              <button
                onClick={onRequestGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-6 py-3 text-body font-semibold text-slate-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GpsPin className="h-5 w-5" />
                {gpsLoading ? t("locating") : t("useMyLocation")}
              </button>
              {gpsSlow && !gpsError && <p className="mt-3 max-w-sm animate-pulse text-caption text-white/70">{t("gpsEnableHint")}</p>}
              {gpsError && (
                <div className="mt-3">
                  <GpsErrorHint
                    error={t(gpsError)}
                    hint={gpsError === "gpsDenied" ? t("gpsDeniedHint") : gpsError === "gpsTimeout" || gpsError === "gpsUnavailable" ? t("gpsEnableHint") : undefined}
                  />
                </div>
              )}
            </div>
          )}
          <div className="max-w-md rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur-sm">
            {onRequestGps && <p className="mb-2 text-caption text-white/70">{t("orSearchCity")}</p>}
            <CitySearch onSelect={onSelectCity} onAddFav={onAddFav} favorites={favorites} allCities={allCities} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[420px] sm:min-h-[520px]">
      {Sky}
      <div className="relative z-10 flex h-full flex-col justify-end gap-4 p-6 sm:p-10 lg:p-14">
        {/* status pill */}
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
          <span className="text-caption sm:text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: dot }}>
            {statusLabel}
          </span>
        </div>

        {/* GIANT headline */}
        <h1 className="font-display font-black text-3xl sm:text-4xl md:text-6xl leading-[1.02] tracking-tight text-white max-w-3xl [text-shadow:0_2px_28px_rgba(0,0,0,0.45)]">
          {headline}
        </h1>
        {hint && (
          <p className="text-lg sm:text-xl text-white/85 max-w-2xl [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
            {hint}
            {(mode === "no_synthesis" || mode === "day_impossible") && (
              <> <span className="text-white/95">{cityFlag} {cityName}</span> · {dateLabel}</>
            )}
          </p>
        )}

        {/* supplement advice for impossible days */}
        {(mode === "no_synthesis" || mode === "day_impossible") && (
          <div className="max-w-lg rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-body text-white/90 backdrop-blur-sm">
            <span className="font-semibold" style={{ color: dot }}>{t("advice")}</span>{" "}
            <Link href="/learn#supplement" className="underline decoration-dotted underline-offset-2 hover:text-white">
              {t("adviceText")}
            </Link>
            <PartnerBadge className="mt-2" />
          </div>
        )}

        {/* details row */}
        {showDetails && (
          <div className="mt-1 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <span className="block text-caption uppercase tracking-wider text-white/55">{t("peakSolar")}</span>
              <span className="font-mono text-xl font-semibold text-white">{peakElevation.toFixed(1)}°</span>
            </div>
            <div>
              <span className="block text-caption uppercase tracking-wider text-white/55">{t("location")}</span>
              <span className="text-xl text-white/90">{cityFlag} {cityName}</span>
            </div>
            <div>
              <span className="block text-caption uppercase tracking-wider text-white/55">{t("date")}</span>
              <span className="text-xl text-white/90">{dateLabel}</span>
            </div>
          </div>
        )}

        {/* GPS + learn row */}
        <div className="flex flex-wrap items-center gap-3">
          {onRequestGps && (
            <button
              onClick={onRequestGps}
              disabled={gpsLoading}
              title={t("useMyLocation")}
              aria-label={t("useMyLocation")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-caption text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GpsPin className="h-3.5 w-3.5" />
              {gpsLoading ? t("locating") : t("useMyLocation")}
            </button>
          )}
          <Link
            href={positive ? "/learn" : "/learn#supplement"}
            className="inline-flex items-center gap-1.5 text-caption text-white/75 hover:text-white transition-colors"
          >
            <span>📖</span>
            <span>{positive ? tc("learnMore") : td("noUvLearnTitle")}</span>
            <span>→</span>
          </Link>
        </div>
        {gpsSlow && !gpsError && <p className="max-w-[280px] animate-pulse text-caption text-white/60">{t("gpsEnableHint")}</p>}
        {gpsError && (
          <GpsErrorHint
            error={t(gpsError)}
            hint={gpsError === "gpsDenied" ? t("gpsDeniedHint") : gpsError === "gpsTimeout" || gpsError === "gpsUnavailable" ? t("gpsEnableHint") : undefined}
          />
        )}
      </div>
    </section>
  );
}
