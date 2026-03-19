"use client";

import { createContext, useContext, useMemo, useCallback, useEffect } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { useLocation } from "@/hooks/useLocation";
import { useGeoLocation } from "@/hooks/useGeoLocation";
import { findNearestCityApi } from "@/lib/cities-api";
import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import type { City } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";

interface AppContextValue {
  // Preferences
  skinType: SkinType;
  setSkinType: (v: SkinType) => void;
  areaFraction: number;
  setAreaFraction: (v: number) => void;
  age: number | null;
  setAge: (v: number | null) => void;
  threshold: number;
  setThreshold: (v: number) => void;
  authUser: User | null;
  onAuthChange: (user: User | null) => void;
  // Location
  lat: number;
  setLat: (v: number) => void;
  lon: number;
  setLon: (v: number) => void;
  tz: number;
  setTz: (v: number) => void;
  cityName: string;
  setCityName: (v: string) => void;
  cityFlag: string;
  setCityFlag: (v: string) => void;
  cityId: string;
  setCityId: (v: string) => void;
  favorites: string[];
  setFavorites: (v: string[]) => void;
  customLocations: City[];
  editingFavs: boolean;
  setEditingFavs: (v: boolean) => void;
  allCities: City[];
  selectCity: (c: City) => void;
  selectFromHeatmap: (lat: number, doy: number, setDoy: (d: number) => void) => void;
  toggleFav: (c: City | string) => void;
  handleSaveLocation: (city: City) => void;
  handleDeleteCustom: (id: string) => void;
  isCurrentFav: boolean;
  // GPS
  gps: {
    lat: number | null;
    lon: number | null;
    loading: boolean;
    slow: boolean;
    error: "gpsDenied" | "gpsTimeout" | "gpsUnavailable" | "gpsGenericError" | "gpsNotSupported" | null;
    permissionDenied: boolean;
    enableGps: () => void;
    disableGps: () => void;
  };
  // Computed
  hasLocation: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations();

  const prefs = usePreferences();
  const loc = useLocation();
  const gps = useGeoLocation();

  // Sync GPS coordinates into location state
  useEffect(() => {
    if (gps.lat !== null && gps.lon !== null) {
      loc.setLat(gps.lat);
      loc.setLon(gps.lon);
      loc.setTz(Math.round(gps.lon / 15));
      loc.setCityName(t("common.myLocation"));
      loc.setCityFlag("\u{1F4CD}");
      loc.setCityId(`gps:${gps.lat.toFixed(4)},${gps.lon.toFixed(4)}`);

      findNearestCityApi(gps.lat, gps.lon).then((city) => {
        if (city) {
          loc.setCityName(`${t("common.myLocation")} (${t("common.near")} ${city.name})`);
          loc.setCityFlag(city.flag ?? "\u{1F4CD}");
          loc.setTz(city.tz);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps.lat, gps.lon]);

  // Persist preferences when they change
  useEffect(() => {
    prefs.persistPreferences(loc.cityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.threshold, loc.cityId, prefs.skinType, prefs.areaFraction, prefs.age, prefs.authUser]);

  // Bridge: handleAuthChange needs setFavorites and setCityId from useLocation
  const onAuthChange = useCallback(
    (user: User | null) => prefs.handleAuthChange(user, loc.setFavorites, loc.setCityId),
    [prefs.handleAuthChange, loc.setFavorites, loc.setCityId],
  );

  const handleSaveLocation = useCallback(
    (city: City) => loc.handleSaveLocation(city),
    [loc.handleSaveLocation],
  );

  const hasLocation = (gps.lat !== null && gps.lon !== null) || loc.cityId !== "builtin:londres";
  const isCurrentFav = loc.favorites.includes(loc.cityId);

  const gpsValue = useMemo(() => ({
    lat: gps.lat,
    lon: gps.lon,
    loading: gps.loading,
    slow: gps.slow,
    error: gps.error,
    permissionDenied: gps.permissionDenied,
    enableGps: gps.enableGps,
    disableGps: gps.disableGps,
  }), [gps.lat, gps.lon, gps.loading, gps.slow, gps.error, gps.permissionDenied, gps.enableGps, gps.disableGps]);

  const value = useMemo<AppContextValue>(() => ({
    skinType: prefs.skinType,
    setSkinType: prefs.setSkinType,
    areaFraction: prefs.areaFraction,
    setAreaFraction: prefs.setAreaFraction,
    age: prefs.age,
    setAge: prefs.setAge,
    threshold: prefs.threshold,
    setThreshold: prefs.setThreshold,
    authUser: prefs.authUser,
    onAuthChange,
    lat: loc.lat,
    setLat: loc.setLat,
    lon: loc.lon,
    setLon: loc.setLon,
    tz: loc.tz,
    setTz: loc.setTz,
    cityName: loc.cityName,
    setCityName: loc.setCityName,
    cityFlag: loc.cityFlag,
    setCityFlag: loc.setCityFlag,
    cityId: loc.cityId,
    setCityId: loc.setCityId,
    favorites: loc.favorites,
    setFavorites: loc.setFavorites,
    customLocations: loc.customLocations,
    editingFavs: loc.editingFavs,
    setEditingFavs: loc.setEditingFavs,
    allCities: loc.allCities,
    selectCity: loc.selectCity,
    selectFromHeatmap: loc.selectFromHeatmap,
    toggleFav: loc.toggleFav,
    handleSaveLocation,
    handleDeleteCustom: loc.handleDeleteCustom,
    isCurrentFav,
    gps: gpsValue,
    hasLocation,
  }), [prefs, loc, gpsValue, onAuthChange, handleSaveLocation, hasLocation, isCurrentFav]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
