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
  targetIU: number = 1000,
): DayRecord {
  const dayHours = hours.filter((h) => h.time.startsWith(dateStr));
  const exposure = computeExposure(dayHours, skinType, areaFraction, targetIU, age);

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

/**
 * Days in the range with no record at all.
 *
 * It used to ask for days with no record *for the currently selected city*, so
 * switching the picker made the whole week look missing and rewrote it with that
 * city. Checking Valencia once from London relabelled the week as Valencia, and
 * that is where the wrong locations in the history came from.
 *
 * A day that already has a record is already answered, whatever place it names.
 * Correcting one is `set_history_location`'s job, not a side effect of looking
 * at a map.
 */
export function datesToFill(
  startStr: string,
  endStr: string,
  existing: DayRecord[],
  now: Date = new Date(),
): string[] {
  const missing: string[] = [];
  const d = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const known = new Set(existing.map((r) => r.date));

  while (d <= end && d <= today) {
    const ds = toDateStr(d);
    if (!known.has(ds)) missing.push(ds);
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
  targetIU: number = 1000,
  authUser?: User | null,
) {
  const [records, setRecords] = useState<DayRecord[]>(() => loadHistory());
  const [loading, setLoading] = useState(!!cityId);
  const activeRequests = useRef(new Set<string>());

  useEffect(() => {
    if (!cityId) {
      return;
    }

    const today = new Date();
    const monday = getMonday(today);
    const todayStr = toDateStr(today);
    const mondayStr = toDateStr(monday);

    // Only fills dates with no record at all. The stored derived fields are
    // legacy weight: the calendar computes the window and the minutes from the
    // current profile, so a stale snapshot is never read. See lib/history-window.ts.
    const stored = loadHistory();
    const missing = datesToFill(mondayStr, todayStr, stored);
    if (missing.length === 0) {
      queueMicrotask(() => setLoading(false));
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
          const record = buildDayRecord(dateStr, cityId, data.hours, skinType, areaFraction, age, targetIU);
          upsertDayRecord(record);
        }
        if (authUser) syncHistoryToSupabase(authUser);
        setRecords(loadHistory());
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [lat, lon, cityId, skinType, areaFraction, age, targetIU, authUser]);

  const requestBackfill = useCallback((startStr: string, endStr: string) => {
    if (!cityId) return;
    const key = `${startStr}:${endStr}`;
    if (activeRequests.current.has(key)) return;

    const stored = loadHistory();
    const missing = datesToFill(startStr, endStr, stored);
    if (missing.length === 0) return;

    activeRequests.current.add(key);

    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&start=${startStr}&end=${endStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.hours) return;
        for (const dateStr of missing) {
          const record = buildDayRecord(dateStr, cityId, data.hours, skinType, areaFraction, age, targetIU);
          upsertDayRecord(record);
        }
        if (authUser) syncHistoryToSupabase(authUser);
        setRecords(loadHistory());
      })
      .catch(() => {})
      .finally(() => activeRequests.current.delete(key));
  }, [lat, lon, cityId, skinType, areaFraction, age, targetIU, authUser]);

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
    // Not filtered by the selected city: today is today wherever the picker
    // happens to be pointing, and requiring a match made the day vanish from the
    // dashboard the moment someone looked up somewhere else.
    return records.find((r) => r.date === todayStr) ?? null;
  }, [records]);

  return { records, loading, getRecordsForWeek, getRecordsForMonth, getToday, toggleOverride, requestBackfill };
}
