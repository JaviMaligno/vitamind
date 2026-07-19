"use client";

import { useState, useMemo, useCallback } from "react";
import { useMounted } from "@/hooks/useMounted";
import { ChevronLeft, ChevronRight, ArrowUpRight, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { indexPath } from "@/lib/city-client-links";
import CityPageLink from "@/components/CityPageLink";
import { useApp } from "@/context/AppProvider";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { getCurve, dayOfYear, dateFromDoy, fmtDate } from "@/lib/solar";
import ExploreHeroBold from "@/components/ExploreHeroBold";
import VisualizationZone from "@/components/VisualizationZone";
import CitySearch from "@/components/CitySearch";
import { Link } from "@/i18n/navigation";
import type { City } from "@/lib/types";
import { useWeather } from "@/hooks/useWeather";
import { useAnimation } from "@/hooks/useAnimation";

export default function ExplorePage() {
  const t = useTranslations();
  const tCity = useTranslations("cityPage");
  const locale = useLocale();
  const app = useApp();

  // Local state (explorer-specific)
  const [doy, setDoy] = useState(dayOfYear(new Date()));
  const [scrubMode, setScrubMode] = useState(false);
  const { animating, toggleAnim } = useAnimation(setDoy);

  // Explore is a sandbox: picking a place here (search, map, heatmap) only
  // changes THIS page, never the dashboard city. The only exception is the
  // first-run poster below, where the user is choosing their city for real.
  const [exploreCity, setExploreCity] = useState<City | null>(null);

  const getCityDisplayName = useCityDisplayName();

  // Local overrides — fall back to global when no local city selected
  const lat = exploreCity?.lat ?? app.lat;
  const lon = exploreCity?.lon ?? app.lon;
  const tz = exploreCity?.tz ?? app.tz;
  const timezone = exploreCity?.timezone ?? app.timezone;
  const cityId = exploreCity?.id ?? app.cityId;
  const rawCityName = exploreCity?.name ?? app.cityName;
  const cityName = getCityDisplayName(cityId, rawCityName);
  const cityFlag = exploreCity?.flag ?? app.cityFlag;

  const date = dateFromDoy(doy);
  const weather = useWeather(lat, lon, date);

  // Computed solar data
  const curve = useMemo(() => getCurve(lat, lon, doy, tz), [lat, lon, doy, tz]);

  const dateLabel = fmtDate(date);

  // Bridge: selectFromHeatmap needs setDoy
  const onSelectFromHeatmap = useCallback(
    (newLat: number, newDoy: number) => {
      setExploreCity((prev) => ({
        ...(prev ?? { id: "explore-heatmap", source: "custom" as const, lat: app.lat, lon: app.lon, tz: app.tz, timezone: app.timezone, name: app.cityName, flag: app.cityFlag }),
        lat: newLat,
      }));
      setDoy(newDoy);
    },
    [app.lat, app.lon, app.tz, app.timezone, app.cityName, app.cityFlag],
  );

  // Hydration guard: this page derives content from `new Date()` (doy →
  // dateLabel/curve) and from localStorage (app.hasLocation, cityName) — both
  // can differ between server and first client render → React #418. Render a
  // stable, data-free placeholder until mounted, then swap to the real
  // content. All hooks above run unconditionally every render.
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8">
        <div className="min-h-[520px]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      {app.hasLocation ? (
        /* Compact lab header — the status poster lives on My Day; Explore is
           the what-if playground (any place, any day of the year). */
        <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:pt-8">
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-text-primary">
            {t("explore.title")}
          </h1>
          <p className="text-body text-text-muted mt-1 max-w-2xl">
            {t("explore.subtitle")}
          </p>
        </div>
      ) : (
        /* First run: no location yet — the poster prompt sets the REAL city. */
        <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:pt-8">
          <ExploreHeroBold
            lat={lat}
            lon={lon}
            onSelectCity={app.selectCity}
            onAddFav={app.toggleFav}
            favorites={app.favorites}
            allCities={app.allCities}
            onRequestGps={app.gps.enableGps}
            gpsLoading={app.gps.loading}
            gpsSlow={app.gps.slow}
            gpsError={app.gps.error}
            onDismissGpsError={app.gps.clearError}
          />
        </div>
      )}

      {/* Local city search — only affects Explore, not Dashboard */}
      {app.hasLocation && (
        <div className="mx-auto max-w-[1280px] px-4 pt-4 pb-2 flex items-center gap-2">
          <div className="flex-1">
            <CitySearch
              onSelect={setExploreCity}
              onAddFav={app.toggleFav}
              favorites={app.favorites}
              allCities={app.allCities}
            />
          </div>
          {exploreCity && (
            <button
              onClick={() => setExploreCity(null)}
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 rounded-lg bg-surface-card text-text-muted text-caption hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {app.cityName}
            </button>
          )}
        </div>
      )}

      {/* Entry into the per-city SEO pages, which are otherwise only reachable
          from Google or the sitemap: the current city direct, plus the full index. */}
      <div className="mx-auto max-w-[1280px] px-4 pb-1 text-caption flex items-center gap-4">
        <CityPageLink cityId={cityId} lat={lat} lon={lon} />
        <Link
          href={indexPath(locale)}
          className="inline-flex min-h-[36px] w-fit items-center gap-1.5 rounded-full border border-glass-border bg-glass px-3 text-caption font-medium text-accent shadow-sm backdrop-blur-md transition-colors hover:bg-surface-elevated"
        >
          {tCity("allCitiesLink")}
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
      </div>

      {/* Zone 2 -- Visualization */}
      <VisualizationZone
        lat={lat}
        lon={lon}
        doy={doy}
        tz={tz}
        timezone={timezone}
        threshold={app.threshold}
        onThresholdChange={app.setThreshold}
        cityName={cityName}
        cityFlag={cityFlag}
        dateLabel={dateLabel}
        curve={curve}
        weather={weather}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
        targetIU={app.targetIU}
        onSelectCity={setExploreCity}
        onSelectFromHeatmap={onSelectFromHeatmap}
        favorites={app.favorites}
        allCities={app.allCities}
        scrubMode={scrubMode}
        onScrubModeToggle={() => setScrubMode((s) => !s)}
      />

      {/* Zone 3 -- Date controls */}
      <section className="mx-auto max-w-[1280px] px-4 pt-6 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDoy((d: number) => Math.max(1, d - 1))}
            aria-label={t("dashboard.calPrev")}
            className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-elevated text-text-secondary cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          {/* 44px-tall touch zone with a thin visual track: appearance-none +
              custom track/thumb so the hitbox is finger-sized while the line
              stays slim (the bare h-1.5 input was a ~6px tall target). */}
          <input
            type="range"
            min="1"
            max="365"
            value={doy}
            onChange={(e) => setDoy(parseInt(e.target.value))}
            aria-label={dateLabel}
            className="h-11 min-w-[140px] flex-1 cursor-pointer appearance-none bg-transparent
              [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-input
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400
              [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface-input
              [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-amber-400"
          />
          <button
            onClick={() => setDoy((d: number) => Math.min(365, d + 1))}
            aria-label={t("dashboard.calNext")}
            className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-elevated text-text-secondary cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <span className="font-mono text-caption text-accent min-w-[64px]">
            {dateLabel}
          </span>
          <button
            onClick={toggleAnim}
            className={`min-h-[44px] px-4 py-1.5 rounded-md text-caption font-semibold cursor-pointer ${
              animating
                ? "bg-red-500/15 text-red-400"
                : "bg-amber-400/10 text-accent"
            }`}
          >
            {animating ? t("config.pause") : t("config.animate")}
          </button>
        </div>
      </section>

      {/* Legend */}
      <div className="mx-auto max-w-[1280px] px-4 mt-6">
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-lg bg-glass border border-glass-border backdrop-blur-md text-caption text-text-muted">
          <span>{t("legend.vitDHours")}</span>
          <div className="w-[100px] h-1.5 rounded-sm bg-gradient-to-r from-[#0a0f28] via-[#b36200] to-amber-400" />
          <span className="font-mono">{t("legend.range")}</span>
          <span>
            <span className="inline-block w-3 h-[1.5px] bg-[#FF6D00] mr-1 align-middle" />
            {t("legend.vitDLimit")}
          </span>
          {weather && (
            <span>
              <span className="inline-block w-3 h-1.5 bg-[rgba(150,150,170,0.3)] mr-1 align-middle rounded-sm" />
              {t("legend.clouds")}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
