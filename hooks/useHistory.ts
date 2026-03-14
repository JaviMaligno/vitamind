"use client";

import { useState, useEffect, useCallback } from "react";
import { loadHistory, upsertDayRecord, toggleDayOverride as toggleOverrideStorage } from "@/lib/storage";
import { computeExposure } from "@/lib/vitd";
import type { DayRecord, WeatherHour } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function buildDayRecord(
  dateStr: string,
  cityId: string,
  hours: WeatherHour[],
  skinType: SkinType,
  areaFraction: number,
  age: number | null,
): DayRecord {
  const dayHours = hours.filter((h) => h.time.startsWith(dateStr));
  const exposure = computeExposure(dayHours, skinType, areaFraction, 1000, age);

  return {
    date: dateStr,
    cityId,
    peakUVI: exposure?.bestUVI ?? 0,
    windowStart: exposure?.windowStart ?? 0,
    windowEnd: exposure?.windowEnd ?? 0,
    minutesNeeded: exposure?.minutesNeeded ?? 0,
    sufficient: exposure !== null && exposure.minutesNeeded > 0 &&
      (exposure.windowEnd - exposure.windowStart) * 60 >= exposure.minutesNeeded,
    userOverride: null,
  };
}

export function useHistory(
  lat: number,
  lon: number,
  cityId: string,
  skinType: SkinType,
  areaFraction: number,
  age: number | null,
) {
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadHistory();
    setRecords(stored);

    const today = new Date();
    const monday = getMonday(today);
    const todayStr = toDateStr(today);
    const mondayStr = toDateStr(monday);

    const missingDates: string[] = [];
    const d = new Date(monday);
    while (d <= today) {
      const ds = toDateStr(d);
      if (!stored.find((r) => r.date === ds && r.cityId === cityId)) {
        missingDates.push(ds);
      }
      d.setDate(d.getDate() + 1);
    }

    if (missingDates.length === 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetch(
      `/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&start=${mondayStr}&end=${todayStr}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.hours) return;
        for (const dateStr of missingDates) {
          const record = buildDayRecord(dateStr, cityId, data.hours, skinType, areaFraction, age);
          upsertDayRecord(record);
        }
        setRecords(loadHistory());
      })
      .catch(() => { /* offline or error */ })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [lat, lon, cityId, skinType, areaFraction, age]);

  const getWeek = useCallback((): DayRecord[] => {
    const today = new Date();
    const monday = getMonday(today);
    const week: DayRecord[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const ds = toDateStr(d);
      const record = records.find((r) => r.date === ds);
      if (record) week.push(record);
    }
    return week;
  }, [records]);

  const getMonth = useCallback((): DayRecord[] => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    return records.filter((r) => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [records]);

  const toggleOverride = useCallback((date: string) => {
    toggleOverrideStorage(date);
    setRecords(loadHistory());
  }, []);

  const getToday = useCallback((): DayRecord | null => {
    const todayStr = toDateStr(new Date());
    return records.find((r) => r.date === todayStr) ?? null;
  }, [records]);

  return { records, loading, getWeek, getMonth, getToday, toggleOverride };
}
