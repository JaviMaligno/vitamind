"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import { vitDHrs, getCurve, getWindow, dayOfYear, dateFromDoy, fmtTime, fmtDate } from "@/lib/solar";
import { computeExposure, computeExposureFromCurve } from "@/lib/vitd";
import HeroZone from "@/components/HeroZone";
import VisualizationZone from "@/components/VisualizationZone";
import ConfigZone from "@/components/ConfigZone";
import { useWeather } from "@/hooks/useWeather";
import { useAnimation } from "@/hooks/useAnimation";

export default function ExplorePage() {
  const t = useTranslations();
  const app = useApp();

  // Local state (explorer-specific)
  const [doy, setDoy] = useState(dayOfYear(new Date()));
  const [scrubMode, setScrubMode] = useState(false);
  const { animating, toggleAnim } = useAnimation(setDoy);

  const date = dateFromDoy(doy);
  const weather = useWeather(app.lat, app.lon, date);

  // Computed solar data
  const curve = useMemo(() => getCurve(app.lat, app.lon, doy, app.tz), [app.lat, app.lon, doy, app.tz]);
  const vitDWindow = useMemo(() => getWindow(curve, app.threshold), [curve, app.threshold]);
  const peak = useMemo(() => Math.max(...curve.map((p) => p.elevation)), [curve]);
  const vdH = vitDHrs(app.lat, doy, app.threshold);

  const exposure = useMemo(() => {
    if (weather?.hours) {
      return computeExposure(weather.hours, app.skinType, app.areaFraction, 1000, app.age);
    }
    return computeExposureFromCurve(curve, app.skinType, app.areaFraction, 1000, app.age);
  }, [weather, curve, app.skinType, app.areaFraction, app.age]);

  const windowLabel = vitDWindow
    ? `${fmtTime(vitDWindow.start)} \u2013 ${fmtTime(vitDWindow.end)}`
    : null;
  const dateLabel = fmtDate(date);

  // Bridge: selectFromHeatmap needs setDoy
  const onSelectFromHeatmap = useCallback(
    (newLat: number, newDoy: number) => app.selectFromHeatmap(newLat, newDoy, setDoy),
    [app.selectFromHeatmap],
  );

  return (
    <>
      {/* Zone 1 -- Hero */}
      <HeroZone
        lat={app.lat}
        lon={app.lon}
        tz={app.tz}
        doy={doy}
        threshold={app.threshold}
        cityName={app.cityName}
        cityFlag={app.cityFlag}
        hasLocation={app.hasLocation}
        onSelectCity={app.selectCity}
        onAddFav={app.toggleFav}
        favorites={app.favorites}
        allCities={app.allCities}
        peakElevation={peak}
        dateLabel={dateLabel}
        onRequestGps={app.gps.enableGps}
        gpsLoading={app.gps.loading}
        gpsSlow={app.gps.slow}
        gpsError={app.gps.error}
      />

      {/* Zone 2 -- Visualization */}
      <VisualizationZone
        lat={app.lat}
        lon={app.lon}
        doy={doy}
        tz={app.tz}
        threshold={app.threshold}
        cityName={app.cityName}
        cityFlag={app.cityFlag}
        dateLabel={dateLabel}
        curve={curve}
        weather={weather}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
        onSelectCity={app.selectCity}
        onSelectFromHeatmap={onSelectFromHeatmap}
        favorites={app.favorites}
        allCities={app.allCities}
        scrubMode={scrubMode}
        onScrubModeToggle={() => setScrubMode((s) => !s)}
      />

      {/* Zone 3 -- Config */}
      <ConfigZone
        lat={app.lat}
        lon={app.lon}
        tz={app.tz}
        cityName={app.cityName}
        cityId={app.cityId}
        cityFlag={app.cityFlag}
        setLat={app.setLat}
        setLon={app.setLon}
        setTz={app.setTz}
        setCityName={app.setCityName}
        setCityFlag={app.setCityFlag}
        onSelectCity={app.selectCity}
        onAddFav={app.toggleFav}
        favorites={app.favorites}
        allCities={app.allCities}
        editingFavs={app.editingFavs}
        setEditingFavs={app.setEditingFavs}
        toggleFav={app.toggleFav}
        handleDeleteCustom={app.handleDeleteCustom}
        isCurrentFav={app.isCurrentFav}
        onSaveLocation={app.handleSaveLocation}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
        onSkinChange={app.setSkinType}
        onAreaChange={app.setAreaFraction}
        onAgeChange={app.setAge}
        doy={doy}
        setDoy={setDoy}
        date={date}
        animating={animating}
        toggleAnim={toggleAnim}
        threshold={app.threshold}
        setThreshold={app.setThreshold}
        notificationProps={{
          lat: app.lat,
          lon: app.lon,
          tz: app.tz,
          skinType: app.skinType,
          areaFraction: app.areaFraction,
          threshold: app.threshold,
          cityName: app.cityName,
        }}
      />

      {/* Legend */}
      <div className="mx-auto max-w-[960px] px-4 mt-6">
        <div className="flex flex-wrap items-center gap-3 py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[9px] text-white/[0.22]">
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
      <div className="mx-auto max-w-[960px] px-4 mt-3 text-[9px] text-white/[0.15] leading-relaxed">
        {t("app.footer")}
      </div>
    </>
  );
}
