"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { BUILTIN_CITIES } from "@/lib/cities";
import { loadFavorites, saveFavorites, loadCustomLocations, saveCustomLocation, deleteCustomLocation, loadPreferences } from "@/lib/storage";
import type { City } from "@/lib/types";

interface InitialLocation {
  lat: number;
  lon: number;
  tz: number;
  timezone: string | undefined;
  cityName: string;
  cityFlag: string;
  cityId: string;
}

const EMPTY_LOCATION: InitialLocation = {
  lat: 0,
  lon: 0,
  tz: 0,
  timezone: undefined,
  cityName: "",
  cityFlag: "",
  cityId: "",
};

function resolveInitialLocation(custom: City[]): InitialLocation {
  const prefs = loadPreferences();
  if (!prefs.lastCityId) return EMPTY_LOCATION;
  const builtinIds = new Set(BUILTIN_CITIES.map((c) => c.id));
  const saved = [...BUILTIN_CITIES, ...custom.filter((c) => !builtinIds.has(c.id))]
    .find((c) => c.id === prefs.lastCityId);
  if (!saved) return EMPTY_LOCATION;
  return {
    lat: saved.lat,
    lon: saved.lon,
    tz: saved.tz,
    timezone: saved.timezone,
    cityName: saved.name,
    cityFlag: saved.flag || "\u{1F4CD}",
    cityId: saved.id,
  };
}

export function useLocation() {
  const [customLocations, setCustomLocations] = useState<City[]>(() => loadCustomLocations());
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [initial] = useState<InitialLocation>(() => resolveInitialLocation(loadCustomLocations()));
  const [lat, setLat] = useState(initial.lat);
  const [lon, setLon] = useState(initial.lon);
  const [tz, setTz] = useState(initial.tz);
  const [timezone, setTimezone] = useState<string | undefined>(initial.timezone);
  const [cityName, setCityName] = useState(initial.cityName);
  const [cityFlag, setCityFlag] = useState(initial.cityFlag);
  const [cityId, setCityId] = useState(initial.cityId);
  const [editingFavs, setEditingFavs] = useState(false);

  // Persist favorites
  useEffect(() => {
    if (favorites.length > 0) saveFavorites(favorites);
  }, [favorites]);

  // All cities = builtin + custom
  const allCities = useMemo(() => {
    const s = new Set(BUILTIN_CITIES.map((c) => c.id));
    return [...BUILTIN_CITIES, ...customLocations.filter((c) => !s.has(c.id))].sort((a, b) => a.name.localeCompare(b.name));
  }, [customLocations]);

  const selectCity = useCallback((c: City) => {
    setLat(c.lat); setLon(c.lon); setTz(c.tz); setTimezone(c.timezone);
    setCityName(c.name); setCityFlag(c.flag || "\u{1F4CD}"); setCityId(c.id);
    if (c.source === "nominatim" && !BUILTIN_CITIES.find((b) => b.id === c.id)) {
      setCustomLocations((prev) => {
        if (prev.find((x) => x.id === c.id)) return prev;
        const updated = [...prev, c];
        saveCustomLocation(c);
        return updated;
      });
    }
  }, []);

  const restoreCity = useCallback((id: string, customCities: City[]) => {
    const builtinIds = new Set(BUILTIN_CITIES.map((c) => c.id));
    const city = [...BUILTIN_CITIES, ...customCities.filter((c) => !builtinIds.has(c.id))]
      .find((c) => c.id === id);
    if (city) {
      setLat(city.lat); setLon(city.lon); setTz(city.tz); setTimezone(city.timezone);
      setCityName(city.name); setCityFlag(city.flag || "\u{1F4CD}"); setCityId(city.id);
    }
  }, []);

  const toggleFav = useCallback((c: City | string) => {
    const id = typeof c === "string" ? c : c.id;
    setFavorites((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
    if (typeof c !== "string" && c.source !== "builtin") {
      setCustomLocations((prev) => {
        if (prev.find((x) => x.id === c.id)) return prev;
        saveCustomLocation(c);
        return [...prev, c];
      });
    }
  }, []);

  const handleSaveLocation = useCallback((city: City) => {
    saveCustomLocation(city);
    setCustomLocations((prev) => [...prev.filter((c) => c.id !== city.id), city]);
    setFavorites((f) => f.includes(city.id) ? f : [...f, city.id]);
    setCityName(city.name); setCityFlag(city.flag || "\u{1F4CD}"); setCityId(city.id);
  }, []);

  const handleDeleteCustom = useCallback((id: string) => {
    deleteCustomLocation(id);
    setCustomLocations((prev) => prev.filter((c) => c.id !== id));
    setFavorites((f) => f.filter((x) => x !== id));
  }, []);

  return {
    lat, setLat,
    lon, setLon,
    tz, setTz,
    timezone, setTimezone,
    cityName, setCityName,
    cityFlag, setCityFlag,
    cityId, setCityId,
    favorites, setFavorites,
    customLocations, setCustomLocations,
    editingFavs, setEditingFavs,
    allCities,
    selectCity,
    restoreCity,
    toggleFav,
    handleSaveLocation,
    handleDeleteCustom,
  };
}
