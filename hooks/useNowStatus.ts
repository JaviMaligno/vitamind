"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getCurrentStatus, type SkinType } from "@/lib/vitd";
import { getCurve } from "@/lib/solar";
import type { NowStatus, WeatherHour } from "@/lib/types";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Provides real-time NowStatus that updates every 60 seconds.
 * Fetches today's weather on mount and re-fetches every hour.
 * Single consolidated timer for both countdown and hourly re-fetch.
 */
export function useNowStatus(
  lat: number,
  lon: number,
  tz: number,
  timezone: string | undefined,
  skinType: SkinType,
  areaFraction: number,
  age: number | null,
  targetIU: number,
): NowStatus {
  const [now, setNow] = useState(() => new Date());
  const [hours, setHours] = useState<WeatherHour[] | null>(null);
  const lastFetchHour = useRef(-1);

  const fetchWeather = useCallback(() => {
    const dateStr = toDateStr(new Date());
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&date=${dateStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.hours) {
          setHours(data.hours);
          lastFetchHour.current = new Date().getHours();
        }
      })
      .catch(() => {});
  }, [lat, lon]);

  // Initial fetch
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Single 60s timer: updates `now` and re-fetches weather on hour boundary
  useEffect(() => {
    const id = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (current.getHours() !== lastFetchHour.current) {
        fetchWeather();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchWeather]);

  // Day-of-year derived from `now` so it updates at midnight
  const doy = useMemo(() => {
    const y = now.getFullYear();
    return Math.floor(
      (now.getTime() - new Date(y, 0, 0).getTime()) / 86400000,
    );
  }, [now]);

  const curve = useMemo(
    () => getCurve(lat, lon, doy, tz, timezone),
    [lat, lon, doy, tz, timezone],
  );

  const weather = useMemo(
    () => (hours ? { hours } : null),
    [hours],
  );

  return useMemo(
    () => getCurrentStatus(weather, curve, skinType, areaFraction, targetIU, age, now, timezone),
    [weather, curve, skinType, areaFraction, targetIU, age, now, timezone],
  );
}
