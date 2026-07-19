"use client";

import { useTranslations } from "next-intl";
import CitySearch from "@/components/CitySearch";
import GpsErrorHint from "@/components/GpsErrorHint";
import { useSolarPhase } from "@/hooks/useSolarPhase";
import { PHASE_STYLE } from "@/lib/solar-phase";
import type { City } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  onSelectCity: (c: City) => void;
  onAddFav: (c: City | string) => void;
  favorites: string[];
  allCities: City[];
  onRequestGps?: () => void;
  gpsLoading?: boolean;
  gpsSlow?: boolean;
  gpsError?: "gpsDenied" | "gpsTimeout" | "gpsUnavailable" | "gpsGenericError" | "gpsNotSupported" | null;
  onDismissGpsError?: () => void;
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
 * First-run poster for Explore (same poster language as the other bold heroes:
 * phase gradient + earthrise + dark scrim) shown only while the user has no
 * location yet — its search/GPS pick sets the REAL city. Once a location
 * exists, Explore shows a compact lab header instead; the live status poster
 * lives on My Day (DayHeroBold), not here.
 */
export default function ExploreHeroBold({
  lat,
  lon,
  onSelectCity,
  onAddFav,
  favorites,
  allCities,
  onRequestGps,
  gpsLoading,
  gpsSlow,
  gpsError,
  onDismissGpsError,
}: Props) {
  const t = useTranslations("hero");
  const phase = useSolarPhase(lat, lon) ?? "day";

  return (
    <section className="relative isolate flex flex-col overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] min-h-[300px] sm:min-h-[380px]">
      {/* Sky: phase gradient + earthrise + scrim */}
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
        style={{ background: "linear-gradient(190deg, rgba(6,8,20,0.05) 0%, rgba(6,8,20,0.24) 42%, rgba(6,8,20,0.8) 100%)" }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-5 p-6 sm:p-10 lg:p-14">
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
                  onDismiss={onDismissGpsError}
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
