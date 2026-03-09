"use client";

import { useState, useEffect } from "react";
import { getCachedWeather, setCachedWeather } from "@/lib/storage";
import type { WeatherData } from "@/lib/types";

export function useWeather(lat: number, lon: number, date: Date) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const cached = getCachedWeather(lat, lon, dateStr);
    if (cached) { setWeather(cached); return; }

    const controller = new AbortController();
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&date=${dateStr}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.hours) {
          const wd: WeatherData = { hours: data.hours, fetchedAt: Date.now() };
          setCachedWeather(lat, lon, dateStr, wd);
          setWeather(wd);
        } else {
          setWeather(null);
        }
      })
      .catch(() => setWeather(null));
    return () => controller.abort();
  }, [lat, lon, date]);

  return weather;
}
