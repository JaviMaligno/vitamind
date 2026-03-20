"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import { useCityDisplayName } from "@/hooks/useCityDisplayName";
import { vitDHrs, getCurve, getWindow, dayOfYear, dateFromDoy, fmtTime, fmtDate } from "@/lib/solar";
import { computeExposure, computeExposureFromCurve } from "@/lib/vitd";
import HeroZone from "@/components/HeroZone";
import VisualizationZone from "@/components/VisualizationZone";
import CitySearch from "@/components/CitySearch";
import GpsButton from "@/components/GpsButton";
import type { City } from "@/lib/types";
import { useWeather } from "@/hooks/useWeather";
import { useAnimation } from "@/hooks/useAnimation";

export default function ExplorePage() {
  const t = useTranslations();
  const app = useApp();

  // Local state (explorer-specific)
  const [doy, setDoy] = useState(dayOfYear(new Date()));
  const [scrubMode, setScrubMode] = useState(false);
  const { animating, toggleAnim } = useAnimation(setDoy);

  const [exploreCity, setExploreCity] = useState<City | null>(null);

  const getCityDisplayName = useCityDisplayName();

  // Local overrides — fall back to global when no local city selected
  const lat = exploreCity?.lat ?? app.lat;
  const lon = exploreCity?.lon ?? app.lon;
  const tz = exploreCity?.tz ?? app.tz;
  const cityId = exploreCity?.id ?? app.cityId;
  const rawCityName = exploreCity?.name ?? app.cityName;
  const cityName = getCityDisplayName(cityId, rawCityName);
  const cityFlag = exploreCity?.flag ?? app.cityFlag;

  const date = dateFromDoy(doy);
  const weather = useWeather(lat, lon, date);

  // Computed solar data
  const curve = useMemo(() => getCurve(lat, lon, doy, tz), [lat, lon, doy, tz]);
  const vitDWindow = useMemo(() => getWindow(curve, app.threshold), [curve, app.threshold]);
  const peak = useMemo(() => Math.max(...curve.map((p) => p.elevation)), [curve]);
  const vdH = vitDHrs(lat, doy, app.threshold);

  const exposure = useMemo(() => {
    if (weather?.hours) {
      return computeExposure(weather.hours, app.skinType, app.areaFraction, app.targetIU, app.age);
    }
    return computeExposureFromCurve(curve, app.skinType, app.areaFraction, app.targetIU, app.age);
  }, [weather, curve, app.skinType, app.areaFraction, app.targetIU, app.age]);

  const windowLabel = vitDWindow
    ? `${fmtTime(vitDWindow.start)} \u2013 ${fmtTime(vitDWindow.end)}`
    : null;
  const dateLabel = fmtDate(date);

  // Bridge: selectFromHeatmap needs setDoy
  const onSelectFromHeatmap = useCallback(
    (newLat: number, newDoy: number) => {
      setExploreCity((prev) => ({
        ...(prev ?? { id: "explore-heatmap", source: "custom" as const, lat: app.lat, lon: app.lon, tz: app.tz, name: app.cityName, flag: app.cityFlag }),
        lat: newLat,
      }));
      setDoy(newDoy);
    },
    [app.lat, app.lon, app.tz, app.cityName, app.cityFlag],
  );

  return (
    <>
      {/* Zone 1 -- Hero */}
      <HeroZone
        lat={lat}
        lon={lon}
        tz={tz}
        doy={doy}
        canSynthesize={exposure !== null}
        cityName={cityName}
        cityFlag={cityFlag}
        hasLocation={app.hasLocation}
        onSelectCity={(c) => setExploreCity(c)}
        onAddFav={app.toggleFav}
        favorites={app.favorites}
        allCities={app.allCities}
        peakElevation={peak}
        dateLabel={dateLabel}
        targetIU={app.targetIU}
        onRequestGps={app.gps.enableGps}
        gpsLoading={app.gps.loading}
        gpsSlow={app.gps.slow}
        gpsError={app.gps.error}
      />

      {/* Local city search — only affects Explore, not Dashboard */}
      {app.hasLocation && (
        <div className="mx-auto max-w-[960px] px-4 pb-2 flex items-center gap-2">
          <div className="flex-1">
            <CitySearch
              onSelect={(city) => setExploreCity(city)}
              onAddFav={app.toggleFav}
              favorites={app.favorites}
              allCities={app.allCities}
            />
          </div>
          {exploreCity && (
            <button
              onClick={() => setExploreCity(null)}
              className="px-3 py-2 rounded-lg bg-surface-card text-text-muted text-xs hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
            >
              × {app.cityName}
            </button>
          )}
          <GpsButton />
        </div>
      )}

      {/* Zone 2 -- Visualization */}
      <VisualizationZone
        lat={lat}
        lon={lon}
        doy={doy}
        tz={tz}
        threshold={app.threshold}
        cityName={cityName}
        cityFlag={cityFlag}
        dateLabel={dateLabel}
        curve={curve}
        weather={weather}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
        targetIU={app.targetIU}
        onSelectCity={(c) => setExploreCity(c)}
        onSelectFromHeatmap={onSelectFromHeatmap}
        favorites={app.favorites}
        allCities={app.allCities}
        scrubMode={scrubMode}
        onScrubModeToggle={() => setScrubMode((s) => !s)}
      />

      {/* Zone 3 -- Date controls */}
      <section className="mx-auto max-w-[960px] px-4 pt-6 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDoy((d: number) => Math.max(1, d - 1))}
            className="min-h-[44px] px-2 py-1.5 rounded-md bg-surface-elevated text-text-secondary cursor-pointer text-[10px]"
          >
            ◀
          </button>
          <input
            type="range"
            min="1"
            max="365"
            value={doy}
            onChange={(e) => setDoy(parseInt(e.target.value))}
            className="flex-1 min-w-[140px] h-1 accent-amber-400"
          />
          <button
            onClick={() => setDoy((d: number) => Math.min(365, d + 1))}
            className="min-h-[44px] px-2 py-1.5 rounded-md bg-surface-elevated text-text-secondary cursor-pointer text-[10px]"
          >
            ▶
          </button>
          <span className="font-mono text-[11px] text-amber-400 min-w-[50px]">
            {dateLabel}
          </span>
          <button
            onClick={toggleAnim}
            className={`min-h-[44px] px-3 py-1.5 rounded-md text-[10px] font-semibold cursor-pointer ${
              animating
                ? "bg-red-500/15 text-red-400"
                : "bg-amber-400/10 text-amber-400"
            }`}
          >
            {animating ? t("config.pause") : t("config.animate")}
          </button>
        </div>
      </section>

      {/* Legend */}
      <div className="mx-auto max-w-[960px] px-4 mt-6">
        <div className="flex flex-wrap items-center gap-3 py-1.5 px-3 rounded-lg bg-surface-card border border-border-subtle text-[9px] text-text-faint">
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

      {/* Footer */}
      <div className="mx-auto max-w-[960px] px-4 mt-3 text-[9px] text-text-faint leading-relaxed">
        {t("app.footer")}
      </div>
    </>
  );
}
