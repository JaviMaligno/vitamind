"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { vitDHrs, getCurve, getWindow, dayOfYear, dateFromDoy, fmtTime, fmtDate } from "@/lib/solar";
import { computeExposure, computeExposureFromCurve } from "@/lib/vitd";
import AuthButton from "@/components/AuthButton";
import LanguageSelector from "@/components/LanguageSelector";
import HeroZone from "@/components/HeroZone";
import VisualizationZone from "@/components/VisualizationZone";
import ConfigZone from "@/components/ConfigZone";
import type { User } from "@supabase/supabase-js";

import { usePreferences } from "@/hooks/usePreferences";
import { useLocation } from "@/hooks/useLocation";
import { useGeoLocation } from "@/hooks/useGeoLocation";
import { useWeather } from "@/hooks/useWeather";
import { useAnimation } from "@/hooks/useAnimation";
import { findNearestCityApi } from "@/lib/cities-api";

export default function App() {
  const t = useTranslations();
  // Local state
  const [doy, setDoy] = useState(dayOfYear(new Date()));
  const [scrubMode, setScrubMode] = useState(false);

  // Custom hooks
  const {
    skinType, setSkinType,
    areaFraction, setAreaFraction,
    age, setAge,
    threshold, setThreshold,
    authUser,
    persistPreferences,
    handleAuthChange,
  } = usePreferences();

  const {
    lat, setLat,
    lon, setLon,
    tz, setTz,
    cityName, setCityName,
    cityFlag, setCityFlag,
    cityId, setCityId,
    favorites, setFavorites,
    editingFavs, setEditingFavs,
    allCities,
    selectCity,
    selectFromHeatmap,
    toggleFav,
    handleSaveLocation: locationSaveHandler,
    handleDeleteCustom,
  } = useLocation();

  const gps = useGeoLocation();

  // Sync GPS coordinates into location state and resolve nearest city name
  useEffect(() => {
    if (gps.lat !== null && gps.lon !== null) {
      setLat(gps.lat);
      setLon(gps.lon);
      setTz(Math.round(gps.lon / 15));
      setCityName(t("common.myLocation"));
      setCityFlag("\u{1F4CD}");
      setCityId(`gps:${gps.lat.toFixed(4)},${gps.lon.toFixed(4)}`);

      // Resolve nearest city name from Supabase
      findNearestCityApi(gps.lat, gps.lon).then((city) => {
        if (city) {
          setCityName(`${t("common.myLocation")} (${t("common.near")} ${city.name})`);
          setCityFlag(city.flag ?? "\u{1F4CD}");
          setTz(city.tz);
        }
      });
    }
  }, [gps.lat, gps.lon, setLat, setLon, setTz, setCityName, setCityFlag, setCityId, t]);

  const date = dateFromDoy(doy);
  const weather = useWeather(lat, lon, date);
  const { animating, toggleAnim } = useAnimation(setDoy);

  // Persist preferences when they change
  useEffect(() => {
    persistPreferences(cityId);
  }, [threshold, cityId, skinType, areaFraction, age, authUser, persistPreferences]);

  // Bridge: handleAuthChange needs setFavorites and setCityId from useLocation
  const onAuthChange = useCallback(
    (user: User | null) => handleAuthChange(user, setFavorites, setCityId),
    [handleAuthChange, setFavorites, setCityId],
  );

  // Bridge: selectFromHeatmap needs setDoy
  const onSelectFromHeatmap = useCallback(
    (newLat: number, newDoy: number) => selectFromHeatmap(newLat, newDoy, setDoy),
    [selectFromHeatmap, setDoy],
  );

  // Bridge: handleSaveLocation
  const handleSaveLocation = useCallback(
    (city: Parameters<typeof locationSaveHandler>[0]) => {
      locationSaveHandler(city);
    },
    [locationSaveHandler],
  );

  // Computed solar data
  const curve = useMemo(() => getCurve(lat, lon, doy, tz), [lat, lon, doy, tz]);
  const vitDWindow = useMemo(() => getWindow(curve, threshold), [curve, threshold]);
  const peak = useMemo(() => Math.max(...curve.map((p) => p.elevation)), [curve]);
  const vdH = vitDHrs(lat, doy, threshold);

  // Exposure calculation for HeroZone
  const exposure = useMemo(() => {
    if (weather?.hours) {
      return computeExposure(weather.hours, skinType, areaFraction, 1000, age);
    }
    return computeExposureFromCurve(curve, skinType, areaFraction, 1000, age);
  }, [weather, curve, skinType, areaFraction, age]);

  // Window label for HeroZone
  const windowLabel = vitDWindow
    ? `${fmtTime(vitDWindow.start)} – ${fmtTime(vitDWindow.end)}`
    : null;

  const dateLabel = fmtDate(date);
  const hasLocation = (gps.lat !== null && gps.lon !== null) || cityId !== "builtin:londres";
  const isCurrentFav = favorites.includes(cityId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a0e27] via-60% to-[#080c20] text-[#e0e0e0] font-[DM_Sans,sans-serif] py-5 px-3">
      {/* Header */}
      <div className="mx-auto max-w-[960px] mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[30px] font-extrabold tracking-tight font-[Playfair_Display,serif] bg-gradient-to-br from-amber-400 to-amber-700 bg-clip-text text-transparent">
              {t("app.title")}
            </span>
            <span className="text-[13px] text-white/30 font-medium">
              {t("app.subtitle")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <AuthButton onAuthChange={onAuthChange} />
          </div>
        </div>
      </div>

      {/* Zone 1 — Hero */}
      <HeroZone
        lat={lat}
        lon={lon}
        tz={tz}
        doy={doy}
        threshold={threshold}
        cityName={cityName}
        cityFlag={cityFlag}
        hasLocation={hasLocation}
        onSelectCity={selectCity}
        onAddFav={toggleFav}
        favorites={favorites}
        allCities={allCities}
        exposure={exposure}
        vitDHours={vdH}
        peakElevation={peak}
        dateLabel={dateLabel}
        windowLabel={windowLabel}
        onRequestGps={gps.enableGps}
        gpsLoading={gps.loading}
        gpsError={gps.error}
      />

      {/* Zone 2 — Visualization */}
      <VisualizationZone
        lat={lat}
        lon={lon}
        doy={doy}
        tz={tz}
        threshold={threshold}
        cityName={cityName}
        cityFlag={cityFlag}
        dateLabel={dateLabel}
        curve={curve}
        weather={weather}
        skinType={skinType}
        areaFraction={areaFraction}
        age={age}
        onSelectCity={selectCity}
        onSelectFromHeatmap={onSelectFromHeatmap}
        favorites={favorites}
        allCities={allCities}
        scrubMode={scrubMode}
        onScrubModeToggle={() => setScrubMode((s) => !s)}
      />

      {/* Zone 3 — Config */}
      <ConfigZone
        lat={lat}
        lon={lon}
        tz={tz}
        cityName={cityName}
        cityId={cityId}
        cityFlag={cityFlag}
        setLat={setLat}
        setLon={setLon}
        setTz={setTz}
        setCityName={setCityName}
        setCityFlag={setCityFlag}
        onSelectCity={selectCity}
        onAddFav={toggleFav}
        favorites={favorites}
        allCities={allCities}
        editingFavs={editingFavs}
        setEditingFavs={setEditingFavs}
        toggleFav={toggleFav}
        handleDeleteCustom={handleDeleteCustom}
        isCurrentFav={isCurrentFav}
        onSaveLocation={handleSaveLocation}
        skinType={skinType}
        areaFraction={areaFraction}
        age={age}
        onSkinChange={setSkinType}
        onAreaChange={setAreaFraction}
        onAgeChange={setAge}
        doy={doy}
        setDoy={setDoy}
        date={date}
        animating={animating}
        toggleAnim={toggleAnim}
        threshold={threshold}
        setThreshold={setThreshold}
        notificationProps={{
          lat,
          lon,
          tz,
          skinType,
          areaFraction,
          threshold,
          cityName,
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
    </div>
  );
}
