"use client";

import { useState, useEffect } from "react";
import { getCachedWeather, setCachedWeather } from "@/lib/storage";
import { canRequestWeatherDate } from "@/lib/weather-dates";
import type { WeatherData } from "@/lib/types";

export function useWeather(lat: number, lon: number, date: Date) {
  // Explore supplies dateFromDoy() (UTC midnight), as does its displayed label.
  const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  const isEmpty = lat === 0 && lon === 0;
  const eligible = !isEmpty && canRequestWeatherDate(dateStr);
  const requestKey = `${lat.toFixed(2)},${lon.toFixed(2)},${dateStr}`;
  const cached = eligible ? getCachedWeather(lat, lon, dateStr) : null;

  const [fetched, setFetched] = useState<{ key: string; data: WeatherData | null } | null>(null);

  useEffect(() => {
    // Explore spans the entire year. Beyond the weather horizon, keep its
    // existing clear-sky model instead of sending requests guaranteed to fail.
    if (!eligible || cached) return;

    const controller = new AbortController();
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&date=${dateStr}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.hours) {
          const wd: WeatherData = { hours: data.hours, fetchedAt: Date.now() };
          setCachedWeather(lat, lon, dateStr, wd);
          setFetched({ key: requestKey, data: wd });
        } else {
          setFetched({ key: requestKey, data: null });
        }
      })
      .catch(() => setFetched({ key: requestKey, data: null }));
    return () => controller.abort();
  }, [lat, lon, dateStr, eligible, cached, requestKey]);

  if (!eligible) return null;
  if (cached) return cached;
  return fetched?.key === requestKey ? fetched.data : null;
}
