# DST-Aware Timezone Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all timezone handling so that solar calculations and vitamin D windows are correct regardless of daylight saving time, and work correctly when the user's browser is in a different timezone than the city being viewed.

**Architecture:** Add IANA timezone strings (`"Europe/Madrid"`) alongside the existing numeric `tz` offset. Compute the offset dynamically for each specific date using `Intl.DateTimeFormat`. Pass `timezone=auto` to Open-Meteo so weather data arrives in the city's local time, and parse hours from the ISO string (not `Date.getHours()`) so they're browser-timezone-independent.

**Tech Stack:** Next.js App Router, TypeScript, `Intl.DateTimeFormat` (no external libraries needed)

---

## Summary of Changes

| File | Change |
|------|--------|
| `lib/types.ts` | Add `timezone?: string` to `City` |
| `lib/timezone.ts` (new) | `tzOffsetForDate()` utility |
| `lib/cities.ts` | Add IANA timezone to each builtin city |
| `lib/cities-api.ts` | Preserve IANA `timezone` from Supabase |
| `lib/solar.ts` | `getCurve()` accepts timezone string |
| `lib/vitd.ts` | Parse hour from ISO string, not `Date.getHours()` |
| `app/api/weather/route.ts` | Pass `timezone=auto` to Open-Meteo |
| `hooks/useLocation.ts` | Add `timezone` state |
| `hooks/useNowStatus.ts` | Pass timezone to `getCurve`, fix `now` hour extraction |
| `context/AppProvider.tsx` | Expose `timezone` in context |
| `components/NotificationToggle.tsx` | Send `timezone` to push API |
| `components/HeroZone.tsx` | Update Props: `timezone?: string` |
| `components/VisualizationZone.tsx` | Update Props: `timezone?: string` |
| `components/CitySearch.tsx` | No IANA available from Nominatim — keep lon fallback |
| `components/WorldMap.tsx` | Same — keep lon fallback |
| `components/SaveLocationModal.tsx` | Same — keep lon fallback |
| `app/explore/page.tsx` | Thread `timezone` to children |
| `app/profile/page.tsx` | Thread `timezone` to NotificationToggle |
| `app/dashboard/page.tsx` | Thread `timezone` to useNowStatus |
| `lib/push-store.ts` | Add `timezone` to `StoredSubscription` |
| `app/api/push/subscribe/route.ts` | Accept `timezone` field |
| `app/api/push/notify/route.ts` | Use `timezone` for solar calc + weather fetch |

---

## Task 1: Timezone Utility Module

Create the core utility that replaces static numeric offsets with date-aware computation.

**Files:**
- Create: `vitamind/lib/timezone.ts`
- Modify: `vitamind/lib/types.ts`

**Step 1: Add `timezone` to City interface**

In `vitamind/lib/types.ts`, add the optional field:

```typescript
export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;  // IANA timezone (e.g. "Europe/Madrid")
  country?: string;
  flag?: string;
  population?: number;
  source: CitySource;
}
```

**Step 2: Create `lib/timezone.ts`**

```typescript
/**
 * Compute the UTC offset (in hours) for a given IANA timezone at a specific date.
 * This correctly handles DST transitions.
 *
 * Example: tzOffsetForDate("Europe/Madrid", new Date("2026-07-15")) => 2  (CEST)
 *          tzOffsetForDate("Europe/Madrid", new Date("2026-01-15")) => 1  (CET)
 */
export function tzOffsetForDate(timezone: string, date: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const match = tzPart.match(/GMT([+-]?\d+)?(?::(\d+))?/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? "0", 10);
    const minutes = parseInt(match[2] ?? "0", 10);
    return hours + (hours < 0 ? -minutes : minutes) / 60;
  } catch {
    return 0;
  }
}

/**
 * Get the effective UTC offset for a city on a given date.
 * Uses IANA timezone if available, otherwise falls back to the stored numeric tz.
 */
export function effectiveTz(
  city: { timezone?: string; tz: number },
  date: Date,
): number {
  if (city.timezone) {
    return tzOffsetForDate(city.timezone, date);
  }
  return city.tz;
}

/**
 * Rough UTC offset from longitude (fallback when no IANA timezone is known).
 */
export function tzFromLon(lon: number): number {
  return Math.round(lon / 15);
}

/**
 * Extract the hour (0-23) from an ISO-like time string "YYYY-MM-DDTHH:MM".
 * This is timezone-independent — it reads the hour literally from the string,
 * which is correct when the string is already in local time (e.g., from
 * Open-Meteo with timezone parameter).
 */
export function hourFromTimeString(time: string): number {
  return parseInt(time.slice(11, 13), 10);
}
```

**Step 3: Verify build compiles**

Run: `cd vitamind && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/timezone.ts lib/types.ts
git commit -m "feat: add IANA timezone utility and City.timezone field"
```

---

## Task 2: Add IANA Timezones to Builtin Cities

**Files:**
- Modify: `vitamind/lib/cities.ts`

**Step 1: Add `t` (timezone IANA) field to BUILTIN_RAW**

Update `BUILTIN_RAW` type and data to include IANA timezone strings. Add `t: string` to each entry:

```typescript
const BUILTIN_RAW: { n: string; lat: number; lon: number; tz: number; c: string; t: string }[] = [
  {n:"Reikiavik",lat:64.15,lon:-21.94,tz:0,c:"🇮🇸",t:"Atlantic/Reykjavik"},
  {n:"Helsinki",lat:60.17,lon:24.94,tz:2,c:"🇫🇮",t:"Europe/Helsinki"},
  {n:"Oslo",lat:59.91,lon:10.75,tz:1,c:"🇳🇴",t:"Europe/Oslo"},
  {n:"Estocolmo",lat:59.33,lon:18.07,tz:1,c:"🇸🇪",t:"Europe/Stockholm"},
  {n:"Moscu",lat:55.76,lon:37.62,tz:3,c:"🇷🇺",t:"Europe/Moscow"},
  {n:"Edimburgo",lat:55.95,lon:-3.19,tz:0,c:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",t:"Europe/London"},
  {n:"Copenhague",lat:55.68,lon:12.57,tz:1,c:"🇩🇰",t:"Europe/Copenhagen"},
  {n:"Dublin",lat:53.35,lon:-6.26,tz:0,c:"🇮🇪",t:"Europe/Dublin"},
  {n:"Berlin",lat:52.52,lon:13.41,tz:1,c:"🇩🇪",t:"Europe/Berlin"},
  {n:"Amsterdam",lat:52.37,lon:4.90,tz:1,c:"🇳🇱",t:"Europe/Amsterdam"},
  {n:"Londres",lat:51.51,lon:-0.13,tz:0,c:"🇬🇧",t:"Europe/London"},
  {n:"Bruselas",lat:50.85,lon:4.35,tz:1,c:"🇧🇪",t:"Europe/Brussels"},
  {n:"Paris",lat:48.86,lon:2.35,tz:1,c:"🇫🇷",t:"Europe/Paris"},
  {n:"Viena",lat:48.21,lon:16.37,tz:1,c:"🇦🇹",t:"Europe/Vienna"},
  {n:"Zurich",lat:47.37,lon:8.54,tz:1,c:"🇨🇭",t:"Europe/Zurich"},
  {n:"Budapest",lat:47.50,lon:19.04,tz:1,c:"🇭🇺",t:"Europe/Budapest"},
  {n:"Vancouver",lat:49.28,lon:-123.12,tz:-8,c:"🇨🇦",t:"America/Vancouver"},
  {n:"Seattle",lat:47.61,lon:-122.33,tz:-8,c:"🇺🇸",t:"America/Los_Angeles"},
  {n:"Toronto",lat:43.65,lon:-79.38,tz:-5,c:"🇨🇦",t:"America/Toronto"},
  {n:"Barcelona",lat:41.39,lon:2.17,tz:1,c:"🇪🇸",t:"Europe/Madrid"},
  {n:"Roma",lat:41.90,lon:12.50,tz:1,c:"🇮🇹",t:"Europe/Rome"},
  {n:"Estambul",lat:41.01,lon:28.98,tz:3,c:"🇹🇷",t:"Europe/Istanbul"},
  {n:"Chicago",lat:41.88,lon:-87.63,tz:-6,c:"🇺🇸",t:"America/Chicago"},
  {n:"Nueva York",lat:40.71,lon:-74.01,tz:-5,c:"🇺🇸",t:"America/New_York"},
  {n:"Madrid",lat:40.42,lon:-3.70,tz:1,c:"🇪🇸",t:"Europe/Madrid"},
  {n:"Pekin",lat:39.90,lon:116.40,tz:8,c:"🇨🇳",t:"Asia/Shanghai"},
  {n:"Atenas",lat:37.98,lon:23.73,tz:2,c:"🇬🇷",t:"Europe/Athens"},
  {n:"Lisboa",lat:38.72,lon:-9.14,tz:0,c:"🇵🇹",t:"Europe/Lisbon"},
  {n:"San Francisco",lat:37.77,lon:-122.42,tz:-8,c:"🇺🇸",t:"America/Los_Angeles"},
  {n:"Seul",lat:37.57,lon:126.98,tz:9,c:"🇰🇷",t:"Asia/Seoul"},
  {n:"Tokio",lat:35.68,lon:139.69,tz:9,c:"🇯🇵",t:"Asia/Tokyo"},
  {n:"Los Angeles",lat:34.05,lon:-118.24,tz:-8,c:"🇺🇸",t:"America/Los_Angeles"},
  {n:"Shanghai",lat:31.23,lon:121.47,tz:8,c:"🇨🇳",t:"Asia/Shanghai"},
  {n:"El Cairo",lat:30.04,lon:31.24,tz:2,c:"🇪🇬",t:"Africa/Cairo"},
  {n:"Delhi",lat:28.61,lon:77.21,tz:5.5,c:"🇮🇳",t:"Asia/Kolkata"},
  {n:"Dubai",lat:25.20,lon:55.27,tz:4,c:"🇦🇪",t:"Asia/Dubai"},
  {n:"Miami",lat:25.76,lon:-80.19,tz:-5,c:"🇺🇸",t:"America/New_York"},
  {n:"Hong Kong",lat:22.32,lon:114.17,tz:8,c:"🇭🇰",t:"Asia/Hong_Kong"},
  {n:"Ciudad de Mexico",lat:19.43,lon:-99.13,tz:-6,c:"🇲🇽",t:"America/Mexico_City"},
  {n:"Bangkok",lat:13.76,lon:100.50,tz:7,c:"🇹🇭",t:"Asia/Bangkok"},
  {n:"Bogota",lat:4.71,lon:-74.07,tz:-5,c:"🇨🇴",t:"America/Bogota"},
  {n:"Singapur",lat:1.35,lon:103.82,tz:8,c:"🇸🇬",t:"Asia/Singapore"},
  {n:"Nairobi",lat:-1.29,lon:36.82,tz:3,c:"🇰🇪",t:"Africa/Nairobi"},
  {n:"Lima",lat:-12.05,lon:-77.04,tz:-5,c:"🇵🇪",t:"America/Lima"},
  {n:"Sao Paulo",lat:-23.55,lon:-46.63,tz:-3,c:"🇧🇷",t:"America/Sao_Paulo"},
  {n:"Buenos Aires",lat:-34.60,lon:-58.38,tz:-3,c:"🇦🇷",t:"America/Argentina/Buenos_Aires"},
  {n:"Santiago",lat:-33.45,lon:-70.67,tz:-4,c:"🇨🇱",t:"America/Santiago"},
  {n:"Ciudad del Cabo",lat:-33.92,lon:18.42,tz:2,c:"🇿🇦",t:"Africa/Johannesburg"},
  {n:"Sidney",lat:-33.87,lon:151.21,tz:11,c:"🇦🇺",t:"Australia/Sydney"},
  {n:"Melbourne",lat:-37.81,lon:144.96,tz:11,c:"🇦🇺",t:"Australia/Melbourne"},
  {n:"Auckland",lat:-36.85,lon:174.76,tz:13,c:"🇳🇿",t:"Pacific/Auckland"},
  {n:"Honolulu",lat:21.31,lon:-157.86,tz:-10,c:"🇺🇸",t:"Pacific/Honolulu"},
  {n:"Anchorage",lat:61.22,lon:-149.90,tz:-9,c:"🇺🇸",t:"America/Anchorage"},
  {n:"Tromso",lat:69.65,lon:18.96,tz:1,c:"🇳🇴",t:"Europe/Oslo"},
  {n:"Sevilla",lat:37.39,lon:-5.98,tz:1,c:"🇪🇸",t:"Europe/Madrid"},
  {n:"Valencia",lat:39.47,lon:-0.38,tz:1,c:"🇪🇸",t:"Europe/Madrid"},
  {n:"Malaga",lat:36.72,lon:-4.42,tz:1,c:"🇪🇸",t:"Europe/Madrid"},
  {n:"Las Palmas",lat:28.10,lon:-15.41,tz:0,c:"🇪🇸",t:"Atlantic/Canary"},
  {n:"Tenerife",lat:28.47,lon:-16.25,tz:0,c:"🇪🇸",t:"Atlantic/Canary"},
  {n:"Marsella",lat:43.30,lon:5.37,tz:1,c:"🇫🇷",t:"Europe/Paris"},
  {n:"Taipei",lat:25.03,lon:121.57,tz:8,c:"🇹🇼",t:"Asia/Taipei"},
  {n:"Medellin",lat:6.25,lon:-75.56,tz:-5,c:"🇨🇴",t:"America/Bogota"},
  {n:"Denver",lat:39.74,lon:-104.99,tz:-7,c:"🇺🇸",t:"America/Denver"},
  {n:"Phoenix",lat:33.45,lon:-112.07,tz:-7,c:"🇺🇸",t:"America/Phoenix"},
  {n:"Varsovia",lat:52.23,lon:21.01,tz:1,c:"🇵🇱",t:"Europe/Warsaw"},
  {n:"Johannesburgo",lat:-26.20,lon:28.05,tz:2,c:"🇿🇦",t:"Africa/Johannesburg"},
  {n:"Perth",lat:-31.95,lon:115.86,tz:8,c:"🇦🇺",t:"Australia/Perth"},
  {n:"Lagos",lat:6.52,lon:3.38,tz:1,c:"🇳🇬",t:"Africa/Lagos"},
  {n:"Casablanca",lat:33.57,lon:-7.59,tz:1,c:"🇲🇦",t:"Africa/Casablanca"},
  {n:"Kuala Lumpur",lat:3.14,lon:101.69,tz:8,c:"🇲🇾",t:"Asia/Kuala_Lumpur"},
  {n:"Montevideo",lat:-34.88,lon:-56.16,tz:-3,c:"🇺🇾",t:"America/Montevideo"},
  {n:"Bombay",lat:19.08,lon:72.88,tz:5.5,c:"🇮🇳",t:"Asia/Kolkata"},
  {n:"Praga",lat:50.08,lon:14.44,tz:1,c:"🇨🇿",t:"Europe/Prague"},
];
```

**Step 2: Pass `timezone` through to City object**

Update the `.map()` in `BUILTIN_CITIES`:

```typescript
export const BUILTIN_CITIES: City[] = BUILTIN_RAW
  .map((c) => ({
    id: `builtin:${c.n.toLowerCase().replace(/\s+/g, "-")}`,
    name: c.n,
    lat: c.lat,
    lon: c.lon,
    tz: c.tz,
    timezone: c.t,
    flag: c.c,
    source: "builtin" as const,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
```

**Step 3: Verify build**

Run: `cd vitamind && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add lib/cities.ts
git commit -m "feat: add IANA timezone strings to all builtin cities"
```

---

## Task 3: Preserve IANA Timezone from Supabase/Geonames

**Files:**
- Modify: `vitamind/lib/cities-api.ts`

**Step 1: Pass `timezone` field through in `toCity()`**

The Supabase row already has `timezone: string` (IANA). Currently it's used only to compute `tz` (numeric) and then discarded. Preserve it:

```typescript
function toCity(row: SupabaseCity): City {
  return {
    id: `geonames:${row.geoname_id}`,
    name: row.display_name ?? row.name,
    lat: row.lat,
    lon: row.lon,
    tz: tzOffset(row.timezone),
    timezone: row.timezone,
    country: row.country_code,
    flag: ccToFlag(row.country_code),
    population: row.population,
    source: "geonames",
  };
}
```

**Step 2: Verify build**

Run: `cd vitamind && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add lib/cities-api.ts
git commit -m "feat: preserve IANA timezone from Supabase city data"
```

---

## Task 4: Fix Weather API to Return City-Local Times

**Files:**
- Modify: `vitamind/app/api/weather/route.ts`

**Step 1: Add `timezone=auto` parameter to Open-Meteo requests**

Open-Meteo supports `timezone=auto` which auto-detects the timezone from coordinates and returns hourly times in that local timezone (without Z suffix). This is the simplest fix.

In the `GET` handler, after setting lat/lon on the URL:

```typescript
url.searchParams.set("timezone", "auto");
```

Add this line after line `url.searchParams.set("hourly", "uv_index,cloud_cover");` (line 34 in current file).

**Step 2: Verify the API returns local times**

After deploying, the `time` strings in the response will change from:
- Before: `"2026-03-29T14:00"` (ambiguous, interpreted as browser-local by JS Date)
- After: `"2026-03-29T14:00"` (explicitly in city's local time)

The format is identical, but the semantics change: the times now represent the city's local time, not UTC. This is why we also need to fix how hours are parsed in vitd.ts (Task 5).

**Step 3: Verify build**

Run: `cd vitamind && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add app/api/weather/route.ts
git commit -m "fix: pass timezone=auto to Open-Meteo for city-local time data"
```

---

## Task 5: Fix Hour Parsing in vitd.ts

**Files:**
- Modify: `vitamind/lib/vitd.ts`

The critical bug: `new Date(wh.time).getHours()` interprets the time string in the browser's local timezone. After Task 4, Open-Meteo returns city-local times, so we must parse the hour directly from the string.

**Step 1: Import `hourFromTimeString`**

At the top of `vitd.ts`:

```typescript
import { hourFromTimeString } from "./timezone";
```

**Step 2: Fix `computeExposure()` (line 199-200)**

Replace:
```typescript
const d = new Date(wh.time);
const h = d.getHours();
```
With:
```typescript
const h = hourFromTimeString(wh.time);
```

**Step 3: Fix `getCurrentStatus()` (line 322-324)**

Replace:
```typescript
for (const wh of weather.hours) {
  const d = new Date(wh.time);
  hourlyUVI.push({ hour: d.getHours(), uvi: wh.uvIndex, cloud: wh.cloudCover });
}
```
With:
```typescript
for (const wh of weather.hours) {
  hourlyUVI.push({ hour: hourFromTimeString(wh.time), uvi: wh.uvIndex, cloud: wh.cloudCover });
}
```

**Step 4: Fix `getCurrentStatus()` — `now` hour extraction (line 314-315)**

The `now.getHours()` and `now.getMinutes()` calls use the browser's timezone, which is wrong if the user is viewing a city in a different timezone. We need to pass the city's timezone and compute the local hour in that timezone.

Update the function signature to accept an optional timezone:

```typescript
export function getCurrentStatus(
  weather: { hours: WeatherHour[] } | null,
  curve: SolarPoint[],
  skinType: SkinType,
  areaFraction: number,
  targetIU: number,
  age: number | null,
  now: Date,
  timezone?: string,
): NowStatus {
```

Then replace the hour/minutes extraction:

```typescript
let currentHour: number;
let currentMinutes: number;
if (timezone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  currentHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  currentMinutes = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  // Intl hour12:false returns 24 for midnight in some engines
  if (currentHour === 24) currentHour = 0;
} else {
  currentHour = now.getHours();
  currentMinutes = now.getMinutes();
}
const minutesFraction = currentMinutes / 60;
```

**Step 5: Verify build**

Run: `cd vitamind && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add lib/vitd.ts
git commit -m "fix: parse hours from time string and support timezone in getCurrentStatus"
```

---

## Task 6: Fix Solar Curve Calculation

**Files:**
- Modify: `vitamind/lib/solar.ts`

**Step 1: Add overloaded `getCurve` that accepts timezone**

Import the utility and update `getCurve` to accept an optional timezone string. When provided, compute the offset dynamically for the given day of year:

```typescript
import { tzOffsetForDate } from "./timezone";
```

Modify `getCurve`:

```typescript
export function getCurve(lat: number, lon: number, doy: number, tz: number, timezone?: string): SolarPoint[] {
  // If IANA timezone provided, compute correct offset for this specific date
  const effectiveTz = timezone
    ? tzOffsetForDate(timezone, dateFromDoy(doy))
    : tz;

  const p: SolarPoint[] = [];
  for (let m = 0; m <= 1440; m += 5) {
    const localH = m / 60;
    const utcH = localH - effectiveTz;
    p.push({ localHours: localH, elevation: solarElev(lat, lon, doy, utcH) });
  }
  return p;
}
```

**Step 2: Verify build**

Run: `cd vitamind && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add lib/solar.ts
git commit -m "fix: getCurve computes DST-correct offset when IANA timezone provided"
```

---

## Task 7: Thread Timezone Through State Management

**Files:**
- Modify: `vitamind/hooks/useLocation.ts`
- Modify: `vitamind/context/AppProvider.tsx`

### Step 1: Add `timezone` state to `useLocation`

In `useLocation.ts`, add state and thread it through:

```typescript
const [timezone, setTimezone] = useState<string | undefined>(undefined);
```

Update `selectCity`:
```typescript
const selectCity = useCallback((c: City) => {
  setLat(c.lat); setLon(c.lon); setTz(c.tz); setTimezone(c.timezone);
  setCityName(c.name); setCityFlag(c.flag || "📍"); setCityId(c.id);
  // ...rest unchanged
}, []);
```

Update the persisted state restore (useEffect around line 32):
```typescript
if (saved) {
  setLat(saved.lat);
  setLon(saved.lon);
  setTz(saved.tz);
  setTimezone(saved.timezone);
  setCityName(saved.name);
  setCityFlag(saved.flag || "📍");
  setCityId(saved.id);
}
```

Update `selectFromHeatmap`:
```typescript
if (near) {
  setLon(near.lon); setTz(near.tz); setTimezone(near.timezone);
  setCityName(near.name); setCityFlag(near.flag || "📍"); setCityId(near.id);
} else {
  setLon(0); setTz(0); setTimezone(undefined);
  // ...rest
}
```

Add to return object:
```typescript
return {
  // ...existing
  timezone, setTimezone,
  // ...existing
};
```

### Step 2: Add `timezone` to AppProvider context

In `AppProvider.tsx`, update `AppContextValue` interface:

```typescript
timezone: string | undefined;
setTimezone: (v: string | undefined) => void;
```

Update the GPS sync effect (line 84-99):
```typescript
if (gps.lat !== null && gps.lon !== null) {
  loc.setLat(gps.lat);
  loc.setLon(gps.lon);
  loc.setTz(Math.round(gps.lon / 15));
  loc.setTimezone(undefined); // Will be set by findNearestCityApi
  loc.setCityName(t("common.myLocation"));
  loc.setCityFlag("📍");
  loc.setCityId(`gps:${gps.lat.toFixed(4)},${gps.lon.toFixed(4)}`);

  findNearestCityApi(gps.lat, gps.lon, locale).then((city) => {
    if (city) {
      loc.setCityName(`${t("common.myLocation")} (${t("common.near")} ${city.name})`);
      loc.setCityFlag(city.flag ?? "📍");
      loc.setTz(city.tz);
      loc.setTimezone(city.timezone);
    }
  });
}
```

Add to the context value object:
```typescript
timezone: loc.timezone,
setTimezone: loc.setTimezone,
```

### Step 3: Verify build

Run: `cd vitamind && npx tsc --noEmit`

### Step 4: Commit

```bash
git add hooks/useLocation.ts context/AppProvider.tsx
git commit -m "feat: thread IANA timezone through location state and app context"
```

---

## Task 8: Update useNowStatus and Dashboard

**Files:**
- Modify: `vitamind/hooks/useNowStatus.ts`
- Modify: `vitamind/app/dashboard/page.tsx`

### Step 1: Update `useNowStatus` to accept and use timezone

```typescript
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
```

Update the `getCurve` call:
```typescript
const curve = useMemo(
  () => getCurve(lat, lon, doy, tz, timezone),
  [lat, lon, doy, tz, timezone],
);
```

Update the `getCurrentStatus` call to pass timezone:
```typescript
return useMemo(
  () => getCurrentStatus(weather, curve, skinType, areaFraction, targetIU, age, now, timezone),
  [weather, curve, skinType, areaFraction, targetIU, age, now, timezone],
);
```

### Step 2: Update dashboard page.tsx

Find the `useNowStatus` call and add `app.timezone`:

```typescript
const nowStatus = useNowStatus(app.lat, app.lon, app.tz, app.timezone, app.skinType, effectiveArea, app.age, app.targetIU);
```

### Step 3: Verify build

Run: `cd vitamind && npx tsc --noEmit`

### Step 4: Commit

```bash
git add hooks/useNowStatus.ts app/dashboard/page.tsx
git commit -m "fix: useNowStatus uses IANA timezone for DST-correct calculations"
```

---

## Task 9: Update Component Props

**Files:**
- Modify: `vitamind/components/HeroZone.tsx` (Props interface only)
- Modify: `vitamind/components/VisualizationZone.tsx` (Props interface only)
- Modify: `vitamind/components/NotificationToggle.tsx`
- Modify: `vitamind/app/explore/page.tsx`
- Modify: `vitamind/app/profile/page.tsx`

### Step 1: Add `timezone` to HeroZone and VisualizationZone Props

In `HeroZone.tsx`:
```typescript
interface Props {
  // ...existing
  tz: number;
  timezone?: string;
  // ...existing
}
```

In `VisualizationZone.tsx`:
```typescript
interface Props {
  // ...existing
  tz: number;
  timezone?: string;
  // ...existing
}
```

Note: These components declare `tz` in props but don't consume it directly (it's only used by parent callers). The `timezone` field follows the same pattern — it's threaded through for child components or future use.

### Step 2: Update explore page to pass timezone

In `app/explore/page.tsx`, update the timezone derivation:
```typescript
const tz = exploreCity?.tz ?? app.tz;
const timezone = exploreCity?.timezone ?? app.timezone;
```

And pass to components:
```typescript
<HeroZone ... tz={tz} timezone={timezone} ... />
<VisualizationZone ... tz={tz} timezone={timezone} ... />
```

Also update the heatmap fallback city object:
```typescript
...(prev ?? { id: "explore-heatmap", source: "custom" as const, lat: app.lat, lon: app.lon, tz: app.tz, timezone: app.timezone, name: app.cityName, flag: app.cityFlag }),
```

### Step 3: Update NotificationToggle to send timezone

In `NotificationToggle.tsx`, add `timezone` to Props:
```typescript
interface Props {
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  skinType: number;
  areaFraction: number;
  cityName: string;
}
```

Update the `toggle` function's POST body:
```typescript
body: JSON.stringify({
  subscription: sub.toJSON(),
  lat, lon, tz, timezone, skinType, areaFraction, cityName,
}),
```

And the subscription update effect:
```typescript
body: JSON.stringify({
  subscription: sub.toJSON(),
  lat, lon, tz, timezone, skinType, areaFraction, cityName,
}),
```

Update the useCallback dependency array:
```typescript
}, [status, lat, lon, tz, timezone, skinType, areaFraction, cityName]);
```

And the useEffect dependency array too.

### Step 4: Update profile page to pass timezone

In `app/profile/page.tsx` line 253:
```typescript
<NotificationToggle ... tz={app.tz} timezone={app.timezone} ... />
```

### Step 5: Verify build

Run: `cd vitamind && npx tsc --noEmit`

### Step 6: Commit

```bash
git add components/HeroZone.tsx components/VisualizationZone.tsx components/NotificationToggle.tsx app/explore/page.tsx app/profile/page.tsx
git commit -m "feat: thread timezone through component props"
```

---

## Task 10: Fix Push Notification System

**Files:**
- Modify: `vitamind/lib/push-store.ts`
- Modify: `vitamind/app/api/push/subscribe/route.ts`
- Modify: `vitamind/app/api/push/notify/route.ts`

### Step 1: Add `timezone` to StoredSubscription

In `push-store.ts`:
```typescript
export interface StoredSubscription {
  subscription: WebPushSubscription;
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  skinType: number;
  areaFraction: number;
  cityName: string;
  createdAt: number;
}
```

Update `saveSubscription` to persist timezone:
```typescript
await sb.from("push_subscriptions").upsert({
  endpoint: sub.subscription.endpoint,
  subscription: sub.subscription,
  lat: sub.lat,
  lon: sub.lon,
  tz: sub.tz,
  timezone: sub.timezone ?? null,
  skin_type: sub.skinType,
  area_fraction: sub.areaFraction,
  city_name: sub.cityName,
  updated_at: new Date().toISOString(),
}, { onConflict: "endpoint" });
```

Update `getAllSubscriptions` to read timezone:
```typescript
return data.map((row) => ({
  subscription: row.subscription as WebPushSubscription,
  lat: row.lat,
  lon: row.lon,
  tz: row.tz,
  timezone: row.timezone ?? undefined,
  skinType: row.skin_type,
  areaFraction: row.area_fraction,
  cityName: row.city_name,
  createdAt: new Date(row.created_at).getTime(),
}));
```

> **Note:** This requires adding a `timezone TEXT` column to the `push_subscriptions` table in Supabase. Run this SQL migration:
> ```sql
> ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone TEXT;
> ```

### Step 2: Update subscribe route to accept timezone

In `app/api/push/subscribe/route.ts`:
```typescript
const { subscription, lat, lon, tz, timezone, skinType, areaFraction, cityName } = body;

await saveSubscription({
  subscription,
  lat: lat ?? 0,
  lon: lon ?? 0,
  tz: tz ?? 0,
  timezone: timezone ?? undefined,
  skinType: skinType ?? 3,
  areaFraction: areaFraction ?? 0.25,
  cityName: cityName ?? "",
  createdAt: Date.now(),
});
```

### Step 3: Update notify route to use timezone

In `app/api/push/notify/route.ts`, update `getCurve` call:
```typescript
const curve = getCurve(sub.lat, sub.lon, doy, sub.tz, sub.timezone);
```

Also update `fetchUVI` to pass timezone:
```typescript
async function fetchUVI(lat: number, lon: number): Promise<{ hour: number; uvi: number }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&start_date=${today}&end_date=${today}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.hourly?.time) return [];
  return data.hourly.time.map((t: string, i: number) => ({
    hour: parseInt(t.slice(11, 13), 10),
    uvi: data.hourly.uv_index?.[i] ?? 0,
  }));
}
```

Note the two changes:
1. Added `&timezone=auto` to the URL
2. Changed `new Date(t).getHours()` to `parseInt(t.slice(11, 13), 10)`

### Step 4: Verify build

Run: `cd vitamind && npx tsc --noEmit`

### Step 5: Commit

```bash
git add lib/push-store.ts app/api/push/subscribe/route.ts app/api/push/notify/route.ts
git commit -m "fix: push notifications use IANA timezone for DST-correct calculations"
```

---

## Task 11: Verify End-to-End

**Step 1: Build the project**

Run: `cd vitamind && npm run build`
Expected: Successful build with no errors

**Step 2: Manual verification checklist**

Run `npm run dev` and verify:

- [ ] Select Madrid — solar curve should show correct window times
- [ ] Switch between builtin cities — timezone changes correctly
- [ ] Search for a city via the search bar (geonames) — timezone preserved
- [ ] Search via Nominatim fallback — tz still uses lon-based estimate (acceptable)
- [ ] Click on WorldMap — tz uses lon-based estimate (acceptable)
- [ ] Check Network tab: `/api/weather` request URL includes `timezone=auto`
- [ ] Weather response times are in city-local timezone (no Z suffix)

**Step 3: Final commit with all changes**

If any fixes were needed during verification, commit them.

---

## Migration Notes

### Supabase Schema

A new column is needed in the `push_subscriptions` table:

```sql
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone TEXT;
```

This is backward-compatible — existing rows will have `timezone = NULL`, which the code handles by falling back to the numeric `tz` field.

### Backward Compatibility

- `City.timezone` is optional — all existing stored cities (localStorage, Supabase) work without it
- `City.tz` is preserved as-is — it's still computed and stored for backward compatibility
- `getCurve()` accepts timezone as an optional parameter — all existing callers work unchanged
- `getCurrentStatus()` accepts timezone as an optional parameter — same
- Cities without IANA timezone (Nominatim, WorldMap click, old saved locations) still use the numeric `tz` fallback — same behavior as before, no regression

### Known Limitations

- **Nominatim cities** don't have IANA timezone — they use `Math.round(lon/15)` which can be off by 1-2 hours near timezone boundaries (same as current behavior)
- **WorldMap click** cities — same limitation
- **Old push subscriptions** without `timezone` column — fall back to numeric `tz` (same as current behavior)
- These limitations could be addressed in a future task by adding a timezone lookup API (e.g., Google Time Zone API or a GeoNames timezone endpoint)
