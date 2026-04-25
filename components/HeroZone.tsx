"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import CitySearch from "@/components/CitySearch";
import PartnerBadge from "@/components/PartnerBadge";
import type { City } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  doy: number;
  canSynthesize: boolean;
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

export default function HeroZone({
  lat,
  lon,
  canSynthesize,
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

  if (!hasLocation) {
    return (
      <section className="mx-auto max-w-[960px] py-12 px-4 text-center">
        <h1 className="text-[36px] font-bold text-text-primary mb-3">
          {t("whereAreYou")}
        </h1>
        <p className="text-sm text-text-muted mb-6">
          {t("searchHint")}
        </p>

        {/* GPS button */}
        {onRequestGps && (
          <div className="mb-6">
            <button
              onClick={onRequestGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/90 hover:bg-amber-500 text-surface font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
              {gpsLoading ? t("locating") : t("useMyLocation")}
            </button>
            {gpsSlow && !gpsError && (
              <p className="mt-3 text-xs text-amber-400/60 max-w-sm mx-auto animate-pulse">
                {t("gpsEnableHint")}
              </p>
            )}
            {gpsError && (
              <div className="mt-3 text-xs text-red-400/80 max-w-sm mx-auto">
                <p>{t(gpsError)}</p>
                {gpsError === "gpsDenied" && (
                  <p className="mt-1 text-text-muted">{t("gpsDeniedHint")}</p>
                )}
                {(gpsError === "gpsTimeout" || gpsError === "gpsUnavailable") && (
                  <p className="mt-1 text-text-muted">{t("gpsEnableHint")}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* City search as alternative */}
        <div className="mx-auto max-w-md">
          {onRequestGps && (
            <p className="text-xs text-text-muted mb-3">{t("orSearchCity")}</p>
          )}
          <CitySearch
            onSelect={onSelectCity}
            onAddFav={onAddFav}
            favorites={favorites}
            allCities={allCities}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[960px] px-4 py-8">
      <div
        className={`rounded-2xl border p-6 md:p-8 shadow-lg ${
          canSynthesize
            ? "border-amber-400/15 bg-gradient-to-br from-amber-400/[0.06] to-orange-600/[0.03]"
            : "border-red-400/10 bg-gradient-to-br from-red-500/[0.06] to-red-900/[0.03]"
        }`}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              canSynthesize ? "bg-amber-400" : "bg-red-400"
            }`}
          />
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              canSynthesize ? "text-amber-400/70" : "text-red-400/70"
            }`}
          >
            {canSynthesize ? t("synthesisPossible") : t("noSynthesis")}
          </span>
        </div>

        {/* Quick action: GPS button */}
        {onRequestGps && (
          <div className="mb-4 flex flex-col items-start gap-1">
            <button
              onClick={onRequestGps}
              disabled={gpsLoading}
              title={t("useMyLocation")}
              aria-label={t("useMyLocation")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                gpsError === "gpsDenied"
                  ? "bg-red-400/10 text-red-400/80 hover:bg-red-400/20"
                  : gpsLoading
                    ? "bg-surface-card text-text-muted"
                    : "bg-surface-card text-text-muted hover:bg-surface-elevated hover:text-text-secondary"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
              {gpsLoading ? t("locating") : t("useMyLocation")}
            </button>
            {gpsSlow && !gpsError && (
              <p className="text-[10px] text-amber-400/60 max-w-[240px] leading-tight animate-pulse">
                {t("gpsEnableHint")}
              </p>
            )}
            {gpsError && (
              <p className="text-[10px] text-red-400/70 max-w-[240px] leading-tight">
                {t(gpsError)}
                {gpsError === "gpsDenied" && (
                  <span className="block text-text-faint mt-0.5">{t("gpsDeniedHint")}</span>
                )}
                {(gpsError === "gpsTimeout" || gpsError === "gpsUnavailable") && (
                  <span className="block text-text-faint mt-0.5">{t("gpsEnableHint")}</span>
                )}
              </p>
            )}
          </div>
        )}

        {canSynthesize ? (
          <>
            <h2 className="text-[36px] md:text-[40px] font-bold text-text-primary leading-tight mb-2">
              {t("synthesisPossible")}
            </h2>
            <p className="text-sm text-text-muted mb-6">
              {t("forVitDDynamic", { iu: targetIU })}
            </p>

            {/* Details row - simplified */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">
                  {t("peakSolar")}
                </span>
                <span className="font-mono text-[15px] font-semibold text-text-primary">
                  {peakElevation.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">
                  {t("location")}
                </span>
                <span className="text-[15px] text-text-secondary">
                  {cityFlag} {cityName}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">
                  {t("date")}
                </span>
                <span className="text-[15px] text-text-secondary">{dateLabel}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[32px] md:text-[36px] font-bold text-text-primary leading-tight mb-2">
              {t("noSynthesisTitle")}
            </h2>
            <p className="text-sm text-text-muted mb-4">
              {t("noSynthesisHint")}{" "}
              <span className="text-text-secondary">
                {cityFlag} {cityName}
              </span>{" "}
              · {dateLabel}
            </p>
            <div className="rounded-xl bg-surface-card border border-border-default px-4 py-3 text-sm text-text-secondary max-w-lg">
              <span className="text-amber-400/70 font-semibold">{t("advice")}</span>{" "}
              <Link href="/learn#supplement" className="underline decoration-dotted hover:text-text-secondary transition-colors">
                {t("adviceText")}
              </Link>
              <PartnerBadge className="mt-2" />
            </div>
          </>
        )}

        {/* Learn more — conditional message */}
        <div className="mt-4 pt-3 border-t border-border-subtle">
          <Link
            href={canSynthesize ? "/learn" : "/learn#supplement"}
            className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <span>📖</span>
            <span>{canSynthesize ? tc("learnMore") : td("noUvLearnTitle")}</span>
            <span className="ml-1">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
