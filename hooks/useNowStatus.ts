"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getCurrentStatus, type SkinType } from "@/lib/vitd";
import { getCurve } from "@/lib/solar";
import type { NowStatus, WeatherHour } from "@/lib/types";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STALE_THRESHOLD = 30 * 60_000; // Re-fetch if data older than 30 minutes

/**
 * Provides real-time NowStatus that updates every 60 seconds.
 * Fetches today's weather on mount and re-fetches every 15 minutes.
 * Also re-fetches when the app returns to the foreground (visibilitychange).
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
  const lastFetchTime = useRef(0);

  const fetchWeather = useCallback(() => {
    if (lat === 0 && lon === 0) return; // no city chosen yet
    const dateStr = toDateStr(new Date());
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&date=${dateStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.hours) {
          setHours(data.hours);
          lastFetchTime.current = Date.now();
        }
      })
      .catch(() => {});
  }, [lat, lon]);

  // Initial fetch
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // 60s timer: updates `now` for countdown/status recalculation
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-fetch when app returns to foreground after being in background
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastFetchTime.current >= STALE_THRESHOLD
      ) {
        fetchWeather();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
