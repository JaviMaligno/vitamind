# Dashboard UX Improvements — Design Document

**Date:** 2026-03-16
**Status:** Validated

## Summary

Three UX improvements to the `/dashboard` page based on user testing:
1. Replace WeekTracker + MonthSummary with a navigable HistoryCalendar (week/month toggle, swipe navigation, corrected summary)
2. Make ForecastRow cards expandable with synthesis detail on tap
3. Fix confusing month summary (wrong denominator, ambiguous text, inconsistent bar)

## 1. HistoryCalendar (replaces WeekTracker + MonthSummary)

### Toggle and navigation

- **Header:** `< [Semana] [Mes] Marzo 2026 >`
- Toggle between week and month view, week is default
- Navigate with `<` `>` arrows AND swipe gesture (touch events, no library)
- Swipe left = forward, swipe right = back
- Cannot navigate past current week/month forward
- Can navigate back up to 90 days (localStorage history limit)

### Week view (default)

- 7 circles (L M X J V S D) like current WeekTracker
- Shows the selected week, not always the current one
- Summary below: "3 de 5 días con condiciones favorables" (only elapsed days with records)

### Month view

- 7-column grid (L-D) × 4-5 rows, all days of the selected month
- Day numbers shown in each cell

### Cell states (3 levels of green)

- **Green strong** (`bg-emerald-500/50`) = user confirmed they went out (`userOverride: true`)
- **Green soft** (`bg-emerald-500/20`) = favorable conditions, not confirmed (automatic)
- **Gray** (`bg-white/[0.06]`) = insufficient conditions
- **Transparent** = no data (future or not registered)
- **Dashed amber border** = today
- **Ring white** = user override active (including `userOverride: false` — "didn't go out" on a favorable day)

### Tap behavior

- Tap a past day → toggle override (same 3-state cycle: null → opposite → null)
- Future days disabled

### Summary below grid

- **Line 1 (conditions):** "12 de 16 días con condiciones favorables" — denominator is elapsed days with records, not total month days. No tilde prefix.
- **Line 2 (confirmed, optional):** "5 confirmados" — only shown if ≥1 positive override exists
- **Supplement hint:** shown when ≥7 records and <40% favorable
- Summary is consistent with current view (week summary for week view, month summary for month view)

### Data / backfill

- `useHistory` hook extended: `backfillMonth(year, month)` in addition to current `backfillWeek`
- When navigating to a past month, fetch historical data from Open-Meteo via `/api/weather?start=...&end=...`
- Cache results in localStorage as DayRecords (already supported)

## 2. ForecastRow Expandable Cards

### Collapsed state (no changes)

Cards with day name, weather icon, peak UVI, condensed window. Same as current.

### Expanded state (on tap)

Panel expands below the forecast row with synthesis detail for that day:

- **Optimal window:** "12:00 – 15:00"
- **Minutes needed:** "~18 min con cara y brazos expuestos" (computed with user profile)
- **Peak UVI:** "5.2"
- **Hourly table (compact):** Only hours with UVI ≥ 3:
  - `12h  UVI 3.1  →  28 min`
  - `13h  UVI 5.2  →  18 min`
  - `14h  UVI 4.0  →  22 min`
- **Average cloud cover:** "45% nubes previstas"

### Behavior

- Only one card expanded at a time — tapping another closes the previous
- Tapping the same card collapses it
- Active card highlighted with amber border
- Smooth height animation (CSS transition `max-height`)

### Data

- `useForecast` already returns hourly data per day
- Pass hours through `computeExposure` with user profile to get minutes needed
- Add `skinType`, `areaFraction`, `age` to useForecast or compute in ForecastRow

## 3. MonthSummary Fix (merged into HistoryCalendar)

### Problems fixed

- **Wrong denominator:** Was using `daysInMonth()` (31), now uses elapsed days with records
- **Inconsistent bar:** Percentage was `favorable/recorded` but text said `favorable/totalMonth`. Now both use same denominator.
- **Ambiguous tilde:** "~1 de 31" looked like "131". Removed tilde.
- **Two components for one concept:** WeekTracker + MonthSummary merged into single HistoryCalendar

### Components removed

- `components/dashboard/WeekTracker.tsx` — deleted
- `components/dashboard/MonthSummary.tsx` — deleted

### Components created

- `components/dashboard/HistoryCalendar.tsx` — replaces both

## Changes to existing files

- `app/dashboard/page.tsx` — replace WeekTracker + MonthSummary with HistoryCalendar, pass expanded props to ForecastRow
- `hooks/useHistory.ts` — add `backfillMonth(year, month)`, `getRecordsForMonth(year, month)`, `getRecordsForWeek(date)`
- `hooks/useForecast.ts` — include hourly data in ForecastDay for expansion
- `components/dashboard/ForecastRow.tsx` — add expand/collapse with detail panel
- `messages/*.json` — add new i18n keys for calendar navigation, confirmed count, etc.
