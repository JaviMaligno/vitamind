"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { loadHistory, upsertDayRecord, toggleDayOverride as toggleOverrideStorage } from "@/lib/storage";
import { computeExposure } from "@/lib/vitd";
import { updateProfile } from "@/lib/profile";
import { buildHistoryWindow, locationSpans, parseGpsCityId, type HistoryWindowDay } from "@/lib/history-window";
import { BUILTIN_CITIES } from "@/lib/cities";
import { nearestCityWithin } from "@/lib/nearest-city";
import type { WeatherRangeFetcher } from "@/lib/weather-range";
import type { DayRecord, WeatherHour, City } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";
import type { User } from "@supabase/supabase-js";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/**
 * How far back the calendar can be navigated, and therefore how much of the
 * history is derived up front. One pass covers every view rather than
 * recomputing on each week or month the user pages to.
 */
export const HISTORY_WINDOW_DAYS = 90;

/** The app's own weather proxy: same upstream rules, plus a shared CDN cache. */
const appWeatherRange: WeatherRangeFetcher = async (lat, lon, from, to) => {
  try {
    const res = await fetch(
      `/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&start=${from}&end=${to}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.hours) ? (data.hours as WeatherHour[]) : null;
  } catch {
    return null;
  }
};

/**
 * The calendar's days, derived rather than read back.
 *
 * The window, the minutes and the UV are a function of (date, place, profile),
 * so storing them meant the past drifted every time the profile changed, and
 * days the app was never open on had nothing at all. The MCP history stopped
 * doing that; this is the same core (`lib/history-window.ts`) behind the app, so
 * the two surfaces cannot disagree about the same day.
 */
export function useHistory(
  lat: number,
  lon: number,
  cityId: string,
  skinType: SkinType,
  areaFraction: number,
  age: number | null,
  targetIU: number = 1000,
  authUser?: User | null,
  customLocations: City[] = [],
) {
  const [stored, setStored] = useState<DayRecord[]>(() => loadHistory());
  const [derived, setDerived] = useState<HistoryWindowDay[]>([]);
  const [loading, setLoading] = useState(!!cityId);

  const resolveCity = useCallback((id: string) => {
    const c = BUILTIN_CITIES.find((b) => b.id === id) ?? customLocations.find((b) => b.id === id);
    return c ? { lat: c.lat, lon: c.lon, timezone: c.timezone } : parseGpsCityId(id);
  }, [customLocations]);

  // Today's row is still written, because where the user is now is an
  // observation nobody can reconstruct later. Everything else is derived.
  useEffect(() => {
    if (!cityId) return;
    const todayStr = toDateStr(new Date());
    if (loadHistory().some((r) => r.date === todayStr)) return;

    const controller = new AbortController();
    fetch(`/api/weather?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&start=${todayStr}&end=${todayStr}`,
      { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.hours) return;
        upsertDayRecord(buildDayRecord(todayStr, cityId, data.hours, skinType, areaFraction, age, targetIU));
        if (authUser) syncHistoryToSupabase(authUser);
        setStored(loadHistory());
      })
      .catch(() => {});
    return () => controller.abort();
  }, [lat, lon, cityId, skinType, areaFraction, age, targetIU, authUser]);

  useEffect(() => {
    if (!cityId) return;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (HISTORY_WINDOW_DAYS - 1));

    // No `setLoading(true)` here: the effect reruns whenever the profile
    // changes, and blanking a calendar that already has days to show it again a
    // moment later is worse than letting the old numbers stand for one frame.
    let cancelled = false;
    buildHistoryWindow({
      from: toDateStr(start),
      to: toDateStr(today),
      records: stored,
      profile: { skinType, area: areaFraction, targetIU, age },
      resolveCity,
      fetchRange: appWeatherRange,
    })
      .then((days) => { if (!cancelled) setDerived(days); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [stored, cityId, skinType, areaFraction, age, targetIU, resolveCity]);

  /**
   * The derived days in the shape the calendar already speaks, so the grid did
   * not have to be rewritten to gain three months of days it never had.
   */
  const records = useMemo<DayRecord[]>(() => derived.map((d) => ({
    date: d.date,
    cityId: d.cityId ?? "",
    peakUVI: d.peakUVI ?? 0,
    windowStart: d.windowStart ?? 0,
    windowEnd: d.windowEnd ?? 0,
    minutesNeeded: d.minutesNeeded ?? 0,
    sufficient: d.sufficient,
    userOverride: d.wentOutside,
  })), [derived]);

  /** Where the user was, in stretches, named for display. */
  const locations = useMemo(() => {
    const nameFor = (id: string | null): string => {
      if (!id) return "";
      const c = BUILTIN_CITIES.find((b) => b.id === id) ?? customLocations.find((b) => b.id === id);
      if (c) return c.name;
      const gps = parseGpsCityId(id);
      if (!gps) return id;
      return nearestCityWithin(gps.lat, gps.lon)?.name ?? `${gps.lat.toFixed(1)}, ${gps.lon.toFixed(1)}`;
    };
    return locationSpans(derived, resolveCity).map((s) => ({ ...s, name: nameFor(s.cityId) }));
  }, [derived, customLocations, resolveCity]);

  /**
   * The dates whose location was inherited rather than recorded.
   *
   * By date, not by stretch: a view showing one week of a three-month stretch
   * has to count the inherited days *in that week*, and scaling the stretch's
   * total down to the clip reported seven of seven inherited on a week where
   * every day had been recorded.
   */
  const assumedDates = useMemo(
    () => derived.filter((d) => d.locationAssumed).map((d) => d.date),
    [derived],
  );

  const toggleOverride = useCallback((date: string) => {
    const day = derived.find((d) => d.date === date);
    toggleOverrideStorage(date, day?.cityId ? { cityId: day.cityId, sufficient: day.sufficient } : undefined);
    if (authUser) syncHistoryToSupabase(authUser);
    setStored(loadHistory());
  }, [authUser, derived]);

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

  const getToday = useCallback((): DayRecord | null => {
    const todayStr = toDateStr(new Date());
    // Not filtered by the selected city: today is today wherever the picker
    // happens to be pointing, and requiring a match made the day vanish from the
    // dashboard the moment someone looked up somewhere else.
    return records.find((r) => r.date === todayStr) ?? null;
  }, [records]);

  return { records, locations, assumedDates, loading, getRecordsForWeek, getRecordsForMonth, getToday, toggleOverride };
}
