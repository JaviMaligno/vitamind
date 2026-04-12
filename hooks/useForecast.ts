"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { hourFromTimeString } from "@/lib/timezone";
import type { WeatherHour } from "@/lib/types";

export interface ForecastDay {
  date: string;
  dayName: string;
  peakUVI: number;
  avgCloud: number;
  windowStart: number;
  windowEnd: number;
  hours: WeatherHour[];
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STALE_THRESHOLD = 30 * 60_000; // Re-fetch if data older than 30 minutes

function parseForecast(data: { hours: WeatherHour[] }): ForecastDay[] {
  const byDate = new Map<string, WeatherHour[]>();
  for (const h of data.hours) {
    const dateStr = h.time.substring(0, 10);
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr)!.push(h);
  }

  const days: ForecastDay[] = [];
  for (const [dateStr, hours] of byDate) {
    const d = new Date(dateStr + "T12:00:00");
    let peakUVI = 0;
    let windowStart = -1;
    let windowEnd = -1;
    let cloudSum = 0;

    for (const h of hours) {
      if (h.uvIndex > peakUVI) peakUVI = h.uvIndex;
      if (h.uvIndex >= 3) {
        const hr = hourFromTimeString(h.time);
        if (windowStart === -1) windowStart = hr;
        windowEnd = hr + 1;
      }
      cloudSum += h.cloudCover;
    }

    days.push({
      date: dateStr,
      dayName: DAY_NAMES_EN[d.getDay()],
      peakUVI: Math.round(peakUVI * 10) / 10,
      avgCloud: Math.round(cloudSum / hours.length),
      windowStart,
      windowEnd,
      hours,
    });
  }

  return days;
}

export function useForecast(lat: number, lon: number): ForecastDay[] | null {
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const lastFetchTime = useRef(0);

  const fetchForecast = useCallback(() => {
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&days=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.hours) return;
        setForecast(parseForecast(data));
        lastFetchTime.current = Date.now();
      })
      .catch(() => setForecast(null));
  }, [lat, lon]);

  // Initial fetch + re-fetch on coordinate change
  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  // Re-fetch when app returns to foreground
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastFetchTime.current >= STALE_THRESHOLD
      ) {
        fetchForecast();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchForecast]);

  return forecast;
}
