"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { loadHistory, upsertDayRecord, toggleDayOverride as toggleOverrideStorage } from "@/lib/storage";
import { computeExposure } from "@/lib/vitd";
import { updateProfile } from "@/lib/profile";
import type { DayRecord, WeatherHour } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";
import type { User } from "@supabase/supabase-js";

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

function datesToFill(startStr: string, endStr: string, existing: DayRecord[], cityId: string): string[] {
  const missing: string[] = [];
  const d = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (d <= end && d <= today) {
    const ds = toDateStr(d);
    if (!existing.find((r) => r.date === ds && r.cityId === cityId)) {
      missing.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return missing;
}

function syncHistoryToSupabase(user: User): void {
  const updated = loadHistory();
  updateProfile(user.id, { history: updated }).catch(() => {});
}

export function useHistory(
  lat: number,
  lon: number,
  cityId: string,
  skinType: SkinType,
  areaFraction: number,
  age: number | null,
  authUser?: User | null,
) {
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const activeRequests = useRef(new Set<string>());

  useEffect(() => {
    const stored = loadHistory();
    setRecords(stored);

    const today = new Date();
    const monday = getMonday(today);
    const todayStr = toDateStr(today);
    const mondayStr = toDateStr(monday);

    const missing = datesToFill(mondayStr, todayStr, stored, cityId);
    if (missing.length === 0) {
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
        for (const dateStr of missing) {
          const record = buildDayRecord(dateStr, cityId, data.hours, skinType, areaFraction, age);
          upsertDayRecord(record);
        }
        if (authUser) syncHistoryToSupabase(authUser);
        setRecords(loadHistory());
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [lat, lon, cityId, skinType, areaFraction, age]);

  const requestBackfill = useCallback((startStr: string, endStr: string) => {
    const key = `${startStr}:${endStr}`;
    if (activeRequests.current.has(key)) return;

    const stored = loadHistory();
    const missing = datesToFill(startStr, endStr, stored, cityId);
    if (missing.length === 0) return;

    activeRequests.current.add(key);

    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&start=${startStr}&end=${endStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.hours) return;
        for (const dateStr of missing) {
          const record = buildDayRecord(dateStr, cityId, data.hours, skinType, areaFraction, age);
          upsertDayRecord(record);
        }
        if (authUser) syncHistoryToSupabase(authUser);
        setRecords(loadHistory());
      })
      .catch(() => {})
      .finally(() => activeRequests.current.delete(key));
  }, [lat, lon, cityId, skinType, areaFraction, age]);

  const getRecordsForWeek = useCallback((mondayDate: Date): DayRecord[] => {
    const week: DayRecord[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + i);
      const ds = toDateStr(d);
      const record = records.find((r) => r.date === ds);
      if (record) week.push(record);
    }
    return week;
  }, [records]);

  const getRecordsForMonth = useCallback((year: number, month: number): DayRecord[] => {
    return records.filter((r) => {
      const d = new Date(r.date + "T12:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [records]);

  const toggleOverride = useCallback((date: string) => {
    toggleOverrideStorage(date);
    if (authUser) syncHistoryToSupabase(authUser);
    setRecords(loadHistory());
  }, [authUser]);

  const getToday = useCallback((): DayRecord | null => {
    const todayStr = toDateStr(new Date());
    return records.find((r) => r.date === todayStr) ?? null;
  }, [records]);

  return { records, loading, getRecordsForWeek, getRecordsForMonth, getToday, toggleOverride, requestBackfill };
}
