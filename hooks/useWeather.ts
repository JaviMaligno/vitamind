"use client";

import { useState, useEffect } from "react";
import { getCachedWeather, setCachedWeather } from "@/lib/storage";
import type { WeatherData } from "@/lib/types";

export function useWeather(lat: number, lon: number, date: Date) {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const isEmpty = lat === 0 && lon === 0;
  const requestKey = `${lat.toFixed(2)},${lon.toFixed(2)},${dateStr}`;
  const cached = isEmpty ? null : getCachedWeather(lat, lon, dateStr);

  const [fetched, setFetched] = useState<{ key: string; data: WeatherData | null } | null>(null);

  useEffect(() => {
    if (isEmpty || cached) return;

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
  }, [lat, lon, dateStr, isEmpty, cached, requestKey]);

  if (isEmpty) return null;
  if (cached) return cached;
  return fetched?.key === requestKey ? fetched.data : null;
}
