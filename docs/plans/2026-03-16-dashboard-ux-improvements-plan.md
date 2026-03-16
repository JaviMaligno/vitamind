# Dashboard UX Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace WeekTracker + MonthSummary with a navigable HistoryCalendar (week/month toggle, swipe, 3-level green), make ForecastRow cards expandable with synthesis detail, and fix the confusing month summary.

**Architecture:** Extend existing hooks (useHistory, useForecast) with new query methods and data fields. Create one new component (HistoryCalendar) and modify one existing (ForecastRow). Add a small useSwipe hook for touch gestures. Delete WeekTracker and MonthSummary.

**Tech Stack:** React, TypeScript, Tailwind CSS, next-intl, touch events API (no library)

**Design doc:** `docs/plans/2026-03-16-dashboard-ux-improvements-design.md`

---

## Important Notes

- **No test framework** configured. Verify each task with `npm run build` from `vitamind/`.
- **6 i18n locale files** must be updated: `es.json`, `en.json`, `fr.json`, `de.json`, `ru.json`, `lt.json`.
- All new components use `"use client"` directive.
- All paths relative to `vitamind/`.
- Git repo root is `vitamind/` (not the parent directory).

---

### Task 1: i18n — Add new keys for calendar and forecast detail

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Modify: `messages/fr.json`
- Modify: `messages/de.json`
- Modify: `messages/ru.json`
- Modify: `messages/lt.json`

**Step 1: Add new keys to the `dashboard` section of each locale**

Add these keys inside the existing `"dashboard"` object in each locale file.

**English (en.json):**
```json
"week": "Week",
"month": "Month",
"confirmedCount": "{count} confirmed",
"favorableSummary": "{count} of {total} days with favorable conditions",
"forecastWindow": "Window",
"forecastMinutes": "~{minutes} min with {area}",
"forecastCloud": "{percent}% cloud cover forecast",
"forecastHourly": "Hourly detail",
"noSynthesisDay": "Insufficient UV",
"tapToExpand": "Tap a day for details"
```

**Spanish (es.json):**
```json
"week": "Semana",
"month": "Mes",
"confirmedCount": "{count} confirmados",
"favorableSummary": "{count} de {total} días con condiciones favorables",
"forecastWindow": "Ventana",
"forecastMinutes": "~{minutes} min con {area}",
"forecastCloud": "{percent}% nubosidad prevista",
"forecastHourly": "Detalle por hora",
"noSynthesisDay": "UV insuficiente",
"tapToExpand": "Toca un día para ver detalle"
```

For fr/de/ru/lt — translate appropriately. Keep `{count}`, `{total}`, `{minutes}`, `{area}`, `{percent}` placeholders unchanged.

**Step 2: Verify build**

Run: `cd vitamind && npm run build`

**Step 3: Commit**

```bash
git add messages/ && git commit -m "feat: add i18n keys for history calendar and forecast detail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extend useHistory hook with period-based queries and backfill

**Files:**
- Modify: `hooks/useHistory.ts`

**Step 1: Add new functions and refactor the hook**

The hook needs:
1. `backfillPeriod(startDate, endDate)` — fetch weather for a date range and create DayRecords for missing days
2. `getRecordsForWeek(mondayDate)` — return records for any week, not just current
3. `getRecordsForMonth(year, month)` — return records for any month
4. `requestBackfill(startDate, endDate)` — exposed to components to trigger backfill for navigated periods

Replace the entire `hooks/useHistory.ts` with:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const activeRequests = useRef(new Set<string>());

  // Initial load + backfill current week
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
        setRecords(loadHistory());
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [lat, lon, cityId, skinType, areaFraction, age]);

  // Backfill an arbitrary date range (called when user navigates calendar)
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
    setRecords(loadHistory());
  }, []);

  const getToday = useCallback((): DayRecord | null => {
    const todayStr = toDateStr(new Date());
    return records.find((r) => r.date === todayStr) ?? null;
  }, [records]);

  return { records, loading, getRecordsForWeek, getRecordsForMonth, getToday, toggleOverride, requestBackfill };
}
```

Key changes from original:
- Replaced `getWeek()` and `getMonth()` (hardcoded to current) with `getRecordsForWeek(mondayDate)` and `getRecordsForMonth(year, month)` that accept parameters
- Added `requestBackfill(start, end)` for on-demand backfill when navigating
- Added `activeRequests` ref to prevent duplicate fetches
- Extracted `datesToFill()` helper to avoid code duplication

**Step 2: Verify build**

Run: `cd vitamind && npm run build`

**Step 3: Commit**

```bash
git add hooks/useHistory.ts && git commit -m "feat: extend useHistory with period-based queries and on-demand backfill

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Extend useForecast to include hourly data

**Files:**
- Modify: `hooks/useForecast.ts`

**Step 1: Add `hours` field to ForecastDay interface**

The ForecastRow expansion needs hourly weather data per day to compute synthesis minutes. Add a `hours` field to `ForecastDay`:

In `hooks/useForecast.ts`, update the interface:

```typescript
export interface ForecastDay {
  date: string;
  dayName: string;
  peakUVI: number;
  avgCloud: number;
  windowStart: number;
  windowEnd: number;
  hours: WeatherHour[];  // NEW: raw hourly data for expansion detail
}
```

And in the loop where days are built, add the hours:

```typescript
days.push({
  date: dateStr,
  dayName: DAY_NAMES_EN[d.getDay()],
  peakUVI: Math.round(peakUVI * 10) / 10,
  avgCloud: Math.round(cloudSum / hours.length),
  windowStart,
  windowEnd,
  hours,  // NEW
});
```

**Step 2: Verify build**

Run: `cd vitamind && npm run build`

**Step 3: Commit**

```bash
git add hooks/useForecast.ts && git commit -m "feat: include hourly data in ForecastDay for expansion detail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create useSwipe hook

**Files:**
- Create: `hooks/useSwipe.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold: number = 50,
): SwipeHandlers {
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - startX.current;
    startX.current = null;

    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchEnd };
}
```

**Step 2: Verify build**

Run: `cd vitamind && npm run build`

**Step 3: Commit**

```bash
git add hooks/useSwipe.ts && git commit -m "feat: add useSwipe hook for touch gesture navigation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Create HistoryCalendar component

**Files:**
- Create: `components/dashboard/HistoryCalendar.tsx`

This is the largest task. The component has:
- Week/month toggle
- Arrow navigation + swipe
- Week view (7 circles) or month view (grid)
- 3-level green cell coloring
- Summary with correct denominator
- Tap to toggle override

**Step 1: Create the component**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSwipe } from "@/hooks/useSwipe";
import type { DayRecord } from "@/lib/types";

type ViewMode = "week" | "month";

interface Props {
  records: DayRecord[];
  onToggleOverride: (date: string) => void;
  onNavigate: (startStr: string, endStr: string) => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getCellStyle(record: DayRecord | null, isToday: boolean, isFuture: boolean): string {
  let bg = "bg-transparent";
  let border = "";

  if (isToday) {
    border = "border-2 border-dashed border-amber-400/40";
  }

  if (!isFuture && record) {
    if (record.userOverride === true) {
      bg = "bg-emerald-500/50"; // confirmed went out
    } else if (record.userOverride === false) {
      bg = "bg-white/[0.06]"; // user said didn't go out
      border += " ring-1 ring-white/20";
    } else if (record.sufficient) {
      bg = "bg-emerald-500/20"; // favorable, not confirmed
    } else {
      bg = "bg-white/[0.06]"; // insufficient
    }
  }

  return `${bg} ${border}`;
}

function computeSummary(records: DayRecord[]): { favorable: number; total: number; confirmed: number } {
  let favorable = 0;
  let confirmed = 0;
  for (const r of records) {
    if (r.userOverride === true) {
      favorable++;
      confirmed++;
    } else if (r.userOverride === false) {
      // user said no — not favorable
    } else if (r.sufficient) {
      favorable++;
    }
  }
  return { favorable, total: records.length, confirmed };
}

export default function HistoryCalendar({ records, onToggleOverride, onNavigate }: Props) {
  const t = useTranslations("dashboard");
  const today = new Date();
  const todayStr = toDateStr(today);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  // For week: offset from current week (0 = this week, -1 = last week, etc.)
  // For month: store year and month directly
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Compute the Monday for the current week offset
  const currentMonday = getMonday(today);
  const viewMonday = new Date(currentMonday);
  viewMonday.setDate(viewMonday.getDate() + weekOffset * 7);

  // Navigation limits
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 90);

  const canGoBack = viewMode === "week"
    ? viewMonday > minDate
    : new Date(viewYear, viewMonth, 1) > minDate;

  const canGoForward = viewMode === "week"
    ? weekOffset < 0
    : viewYear < today.getFullYear() || viewMonth < today.getMonth();

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    if (viewMode === "week") {
      setWeekOffset((o) => o - 1);
    } else {
      setViewMonth((m) => {
        if (m === 0) { setViewYear((y) => y - 1); return 11; }
        return m - 1;
      });
    }
  }, [canGoBack, viewMode]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    if (viewMode === "week") {
      setWeekOffset((o) => o + 1);
    } else {
      setViewMonth((m) => {
        if (m === 11) { setViewYear((y) => y + 1); return 0; }
        return m + 1;
      });
    }
  }, [canGoForward, viewMode]);

  const swipeHandlers = useSwipe(goForward, goBack);

  // Request backfill when navigating
  useEffect(() => {
    if (viewMode === "week") {
      const start = toDateStr(viewMonday);
      const end = new Date(viewMonday);
      end.setDate(end.getDate() + 6);
      onNavigate(start, toDateStr(end));
    } else {
      const start = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
      const lastDay = daysInMonth(viewYear, viewMonth);
      const end = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      onNavigate(start, end);
    }
  }, [viewMode, weekOffset, viewYear, viewMonth, onNavigate]);

  // Filter records for current view
  const viewRecords = viewMode === "week"
    ? (() => {
        const recs: DayRecord[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(viewMonday);
          d.setDate(d.getDate() + i);
          const ds = toDateStr(d);
          const r = records.find((rec) => rec.date === ds);
          if (r) recs.push(r);
        }
        return recs;
      })()
    : records.filter((r) => {
        const d = new Date(r.date + "T12:00:00");
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      });

  const summary = computeSummary(viewRecords);

  // Header label
  const headerLabel = viewMode === "week"
    ? (() => {
        const endOfWeek = new Date(viewMonday);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const startDay = viewMonday.getDate();
        const endDay = endOfWeek.getDate();
        const monthName = MONTH_NAMES[viewMonday.getMonth()];
        if (viewMonday.getMonth() === endOfWeek.getMonth()) {
          return `${startDay}–${endDay} ${monthName}`;
        }
        return `${startDay} ${MONTH_NAMES[viewMonday.getMonth()]} – ${endDay} ${MONTH_NAMES[endOfWeek.getMonth()]}`;
      })()
    : `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4" {...swipeHandlers}>
      {/* Header: toggle + navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("week")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === "week" ? "bg-amber-400/20 text-amber-400" : "text-white/30 hover:text-white/50"
            }`}
          >
            {t("week")}
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === "month" ? "bg-amber-400/20 text-amber-400" : "text-white/30 hover:text-white/50"
            }`}
          >
            {t("month")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-default text-sm px-1"
          >
            ‹
          </button>
          <span className="text-xs text-white/40 min-w-[120px] text-center">{headerLabel}</span>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-default text-sm px-1"
          >
            ›
          </button>
        </div>
      </div>

      {/* Week view */}
      {viewMode === "week" && (
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(viewMonday);
            d.setDate(d.getDate() + i);
            const ds = toDateStr(d);
            const record = records.find((r) => r.date === ds) ?? null;
            const isFuture = d > today;
            const isToday = ds === todayStr;
            const style = getCellStyle(record, isToday, isFuture);

            return (
              <button
                key={ds}
                onClick={() => record && !isFuture && onToggleOverride(ds)}
                disabled={isFuture || !record}
                className={`flex flex-col items-center justify-center rounded-full w-10 h-10 flex-shrink-0 transition-colors ${style} ${
                  isFuture ? "opacity-30 cursor-default" : "cursor-pointer hover:ring-1 hover:ring-amber-400/30"
                }`}
              >
                <span className="text-[10px] font-medium text-white/50">{DAY_LABELS[i]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {viewMode === "month" && (() => {
        const totalDays = daysInMonth(viewYear, viewMonth);
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        // Convert Sunday=0 to Monday-based: Mon=0, Tue=1, ..., Sun=6
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const cells: (number | null)[] = [];

        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= totalDays; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <div>
            {/* Day labels header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((label) => (
                <div key={label} className="text-center text-[9px] text-white/25 font-medium">{label}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="h-8" />;

                const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const d = new Date(viewYear, viewMonth, day);
                const record = records.find((r) => r.date === ds) ?? null;
                const isFuture = d > today;
                const isToday = ds === todayStr;
                const style = getCellStyle(record, isToday, isFuture);

                return (
                  <button
                    key={ds}
                    onClick={() => record && !isFuture && onToggleOverride(ds)}
                    disabled={isFuture || !record}
                    className={`flex items-center justify-center rounded-md h-8 text-[10px] font-medium transition-colors ${style} ${
                      isFuture ? "opacity-30 cursor-default text-white/20" : "cursor-pointer hover:ring-1 hover:ring-amber-400/30 text-white/50"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Summary */}
      <div className="mt-3 space-y-1">
        {summary.total > 0 && (
          <p className="text-sm text-white/50">
            {t("favorableSummary", { count: summary.favorable, total: summary.total })}
          </p>
        )}
        {summary.confirmed > 0 && (
          <p className="text-xs text-emerald-400/60">
            {t("confirmedCount", { count: summary.confirmed })}
          </p>
        )}
        {summary.total >= 7 && summary.favorable < summary.total * 0.4 && (
          <p className="text-xs text-amber-400/50">
            {t("supplementHint")}
          </p>
        )}
      </div>

      <p className="text-[10px] text-white/20 mt-2 text-center">{t("tapToExpand")}</p>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd vitamind && npm run build`

**Step 3: Commit**

```bash
git add components/dashboard/HistoryCalendar.tsx && git commit -m "feat: add HistoryCalendar with week/month toggle, swipe, and 3-level green

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Make ForecastRow expandable

**Files:**
- Modify: `components/dashboard/ForecastRow.tsx`

**Step 1: Add expand/collapse with synthesis detail panel**

Replace the entire `components/dashboard/ForecastRow.tsx` with:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { computeExposure } from "@/lib/vitd";
import type { ForecastDay } from "@/hooks/useForecast";
import type { SkinType } from "@/lib/vitd";

interface Props {
  forecast: ForecastDay[] | null;
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
}

function weatherIcon(avgCloud: number, peakUVI: number): string {
  if (peakUVI < 1) return "\u{2601}\u{FE0F}";
  if (avgCloud > 70) return "\u{1F325}\u{FE0F}";
  if (avgCloud > 30) return "\u{26C5}";
  return "\u{2600}\u{FE0F}";
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function getAreaKey(areaFraction: number): string {
  if (areaFraction <= 0.10) return "faceHands";
  if (areaFraction <= 0.18) return "faceArms";
  if (areaFraction <= 0.25) return "tshirtShort";
  return "swimsuit";
}

export default function ForecastRow({ forecast, skinType, areaFraction, age }: Props) {
  const t = useTranslations("dashboard");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (!forecast) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("forecast")}</h3>
        <p className="text-sm text-white/30">{t("noForecast")}</p>
      </div>
    );
  }

  const expandedDay = expandedDate ? forecast.find((d) => d.date === expandedDate) : null;
  const exposure = expandedDay
    ? computeExposure(expandedDay.hours, skinType, areaFraction, 1000, age)
    : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("forecast")}</h3>
      <div className="flex gap-2 overflow-x-auto">
        {forecast.map((day) => {
          const hasWindow = day.windowStart >= 0 && day.windowEnd > day.windowStart;
          const isExpanded = expandedDate === day.date;
          return (
            <button
              key={day.date}
              onClick={() => setExpandedDate(isExpanded ? null : day.date)}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 min-w-[72px] transition-colors cursor-pointer ${
                isExpanded
                  ? "bg-white/[0.06] border-amber-400/30"
                  : "bg-white/[0.03] border-white/[0.04] hover:border-white/[0.08]"
              }`}
            >
              <span className="text-[11px] font-medium text-white/40">{day.dayName}</span>
              <span className="text-lg">{weatherIcon(day.avgCloud, day.peakUVI)}</span>
              <span className={`text-xs font-mono font-semibold ${day.peakUVI >= 3 ? "text-amber-400" : "text-white/30"}`}>
                UVI {day.peakUVI}
              </span>
              <span className="text-[10px] text-white/30">
                {hasWindow ? `${day.windowStart}\u{2013}${day.windowEnd}h` : "\u{2014}"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expandedDay ? "300px" : "0px", opacity: expandedDay ? 1 : 0 }}
      >
        {expandedDay && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
            {exposure ? (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/25 block">{t("forecastWindow")}</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {formatHour(exposure.windowStart)} – {formatHour(exposure.windowEnd)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/25 block">{t("peakUVI")}</span>
                    <span className="font-mono text-white/70 font-semibold">{exposure.bestUVI.toFixed(1)}</span>
                  </div>
                </div>

                <p className="text-xs text-white/40">
                  {t("forecastMinutes", { minutes: Math.round(exposure.minutesNeeded), area: t(getAreaKey(areaFraction)) })}
                </p>

                {/* Hourly table */}
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-white/25">{t("forecastHourly")}</span>
                  <div className="mt-1 space-y-0.5">
                    {exposure.hourlyMinutes
                      .filter((h) => h.uvi >= 3)
                      .map((h) => (
                        <div key={h.hour} className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-white/30 w-8">{String(h.hour).padStart(2, "0")}h</span>
                          <span className="text-amber-400/70 w-12">UVI {h.uvi.toFixed(1)}</span>
                          <span className="text-white/50">→ {h.minutes !== null ? `${Math.round(h.minutes)} min` : "—"}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <p className="text-[10px] text-white/25">
                  {t("forecastCloud", { percent: expandedDay.avgCloud })}
                </p>
              </>
            ) : (
              <p className="text-sm text-white/30">{t("noSynthesisDay")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

Key changes:
- Changed cards from `<div>` to `<button>` with onClick
- Added `expandedDate` state — only one card expands at a time
- Added detail panel below the row with max-height CSS transition
- New props: `skinType`, `areaFraction`, `age` (needed to compute exposure for the expanded day)
- Uses `computeExposure` from `lib/vitd.ts` on the `day.hours` data

**Step 2: Verify build**

Run: `cd vitamind && npm run build`

**Step 3: Commit**

```bash
git add components/dashboard/ForecastRow.tsx && git commit -m "feat: make ForecastRow cards expandable with synthesis detail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Update dashboard page and delete old components

**Files:**
- Modify: `app/dashboard/page.tsx`
- Delete: `components/dashboard/WeekTracker.tsx`
- Delete: `components/dashboard/MonthSummary.tsx`

**Step 1: Update dashboard page**

Replace `app/dashboard/page.tsx` with:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import { useHistory } from "@/hooks/useHistory";
import { useForecast } from "@/hooks/useForecast";
import DayRecommendation from "@/components/dashboard/DayRecommendation";
import ForecastRow from "@/components/dashboard/ForecastRow";
import HistoryCalendar from "@/components/dashboard/HistoryCalendar";
import CitySearch from "@/components/CitySearch";
import Link from "next/link";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const app = useApp();

  const { records, loading, getToday, toggleOverride, requestBackfill } = useHistory(
    app.lat, app.lon, app.cityId, app.skinType, app.areaFraction, app.age,
  );
  const forecast = useForecast(app.lat, app.lon);

  const todayRecord = getToday();

  return (
    <div className="mx-auto max-w-[960px] px-3 space-y-4">
      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <CitySearch
            onSelect={app.selectCity}
            onAddFav={app.toggleFav}
            favorites={app.favorites}
            allCities={app.allCities}
          />
        </div>
        <Link
          href="/explore"
          className="px-3 py-2 rounded-lg bg-white/[0.04] text-white/30 text-xs hover:bg-white/[0.08] hover:text-white/50 transition-colors whitespace-nowrap"
        >
          {t("editProfile")}
        </Link>
      </div>

      {/* Hero: Today's recommendation */}
      <DayRecommendation
        record={todayRecord}
        cityName={app.cityName}
        cityFlag={app.cityFlag}
        areaFraction={app.areaFraction}
        loading={loading}
      />

      {/* 5-day forecast (expandable) */}
      <ForecastRow
        forecast={forecast}
        skinType={app.skinType}
        areaFraction={app.areaFraction}
        age={app.age}
      />

      {/* History calendar (replaces WeekTracker + MonthSummary) */}
      <HistoryCalendar
        records={records}
        onToggleOverride={toggleOverride}
        onNavigate={requestBackfill}
      />
    </div>
  );
}
```

Changes:
- Removed `WeekTracker` and `MonthSummary` imports and usages
- Removed `getWeek()` and `getMonth()` calls (no longer in useHistory)
- Added `records` and `requestBackfill` from useHistory
- Added `HistoryCalendar` with `onNavigate={requestBackfill}`
- ForecastRow now receives `skinType`, `areaFraction`, `age`

**Step 2: Delete old components**

```bash
rm components/dashboard/WeekTracker.tsx components/dashboard/MonthSummary.tsx
```

**Step 3: Verify build**

Run: `cd vitamind && npm run build`

**Step 4: Commit**

```bash
git add app/dashboard/page.tsx && git rm components/dashboard/WeekTracker.tsx components/dashboard/MonthSummary.tsx && git commit -m "feat: replace WeekTracker + MonthSummary with HistoryCalendar, wire expandable forecast

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Final verification

**Step 1: Full build**

Run: `cd vitamind && npm run build`
Expected: Build succeeds with no errors.

**Step 2: Check deleted files aren't referenced anywhere**

```bash
grep -r "WeekTracker\|MonthSummary" --include="*.tsx" --include="*.ts" .
```
Expected: No matches (the old imports in dashboard/page.tsx are gone).

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: final adjustments after dashboard UX improvements

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task Dependency Graph

```
Task 1 (i18n) ──────────────┐
Task 2 (useHistory) ─────────┤
Task 3 (useForecast) ────────┤
Task 4 (useSwipe) ───────────┤
                              ├──→ Task 5 (HistoryCalendar) ──┐
                              ├──→ Task 6 (ForecastRow) ───────┤
                              │                                 │
                              └──→ Task 7 (Dashboard + delete) ─┤
                                                                │
                                              Task 8 (Verify) ──┘
```

**Parallelizable:** Tasks 1, 2, 3, 4 are all independent.
**Critical path:** Tasks 1-4 → Task 5 → Task 7 → Task 8
