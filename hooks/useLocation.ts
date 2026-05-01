"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { BUILTIN_CITIES, findNearestCity } from "@/lib/cities";
import { loadFavorites, saveFavorites, loadCustomLocations, saveCustomLocation, deleteCustomLocation, loadPreferences } from "@/lib/storage";
import type { City } from "@/lib/types";

export function useLocation() {
  const [lat, setLat] = useState(0);
  const [lon, setLon] = useState(0);
  const [tz, setTz] = useState(0);
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  const [cityName, setCityName] = useState("");
  const [cityFlag, setCityFlag] = useState("");
  const [cityId, setCityId] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customLocations, setCustomLocations] = useState<City[]>([]);
  const [editingFavs, setEditingFavs] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    setFavorites(loadFavorites());
    const custom = loadCustomLocations();
    setCustomLocations(custom);

    // Restore last selected city from preferences (real saved choice, not the legacy Londres default)
    const prefs = loadPreferences();
    if (prefs.lastCityId) {
      const builtinIds = new Set(BUILTIN_CITIES.map((c) => c.id));
      const saved = [...BUILTIN_CITIES, ...custom.filter((c) => !builtinIds.has(c.id))]
        .find((c) => c.id === prefs.lastCityId);
      if (saved) {
        setLat(saved.lat);
        setLon(saved.lon);
        setTz(saved.tz);
        setTimezone(saved.timezone);
        setCityName(saved.name);
        setCityFlag(saved.flag || "\u{1F4CD}");
        setCityId(saved.id);
      }
    }
  }, []);

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

  const selectFromHeatmap = useCallback((newLat: number, newDoy: number, setDoy: (d: number) => void) => {
    const rL = Math.round(newLat * 10) / 10;
    setLat(rL); setDoy(Math.max(1, Math.min(365, Math.round(newDoy))));
    const near = findNearestCity(rL, BUILTIN_CITIES);
    if (near) {
      setLon(near.lon); setTz(near.tz); setTimezone(near.timezone); setCityName(near.name); setCityFlag(near.flag || "\u{1F4CD}"); setCityId(near.id);
    } else {
      setLon(0); setTz(0); setTimezone(undefined);
      setCityName(`Lat ${Math.round(rL)}\u00B0`); setCityFlag("\u{1F4CD}"); setCityId(`custom:lat-${rL}`);
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
    selectFromHeatmap,
    restoreCity,
    toggleFav,
    handleSaveLocation,
    handleDeleteCustom,
  };
}
