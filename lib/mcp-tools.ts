import { BUILTIN_CITIES } from "./cities";
import { CITY_SLUGS } from "./city-slugs";
import { getSunTimes } from "./sun-times";
import { getCurve, dayOfYear, fmtTime, dateFromDoy } from "./solar";
import {
  computeExposureFromCurve, getCurrentStatus, maxSessionIU, MIN_UVI, type SkinType,
} from "./vitd";
import { ozoneDU } from "./uv-model";
import { cityYearProfile, viableDateBoundaries } from "./city-content";
import type { WeatherHour } from "./types";

/**
 * Pure tool implementations behind the MCP endpoint (`app/api/mcp`). Each maps
 * validated arguments to a plain JSON-serializable result. Kept out of the
 * route so they can be unit-tested without HTTP or the MCP transport.
 *
 * Everything here is public, read-only data derived from the same models the
 * app itself uses — no auth, no user state, no secrets.
 */

const DISCLAIMER =
  "Clear-sky model estimate for healthy adults; not medical advice. Cloud cover can reduce or remove the real window.";

// ---------------------------------------------------------------------------
// search_city

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface CityResult {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  timezone?: string;
  elevationM?: number;
}

/** Match against the built-in city DB: Spanish base names + the six locales'
 *  URL slugs, so "London", "Londres" and "londonas" all find the same city. */
export function searchCity(query: string, limit = 5): CityResult[] {
  const q = strip(query);
  if (!q) return [];

  const scored: { score: number; city: CityResult }[] = [];
  for (const c of BUILTIN_CITIES) {
    const base = c.id.replace(/^builtin:/, "");
    const names = new Set<string>([strip(c.name), base.replace(/-/g, " ")]);
    for (const slug of Object.values(CITY_SLUGS[base] ?? {})) {
      names.add(slug.replace(/-/g, " "));
    }
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 3);
      else if (n.startsWith(q)) score = Math.max(score, 2);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    if (score > 0) {
      scored.push({
        score,
        city: { name: c.name, country: c.country, lat: c.lat, lon: c.lon, timezone: c.timezone, elevationM: c.elevation },
      });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.city);
}

// ---------------------------------------------------------------------------
// get_sun_times

export interface SunTimesArgs {
  lat: number;
  lon: number;
  /** YYYY-MM-DD; defaults to today. */
  date?: string;
  /** IANA timezone. Without it, times come back in UTC. */
  timezone?: string;
}

function parseDate(date?: string): Date {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(`${date}T12:00:00`);
  return new Date();
}

const t = (h: number | null) => (h !== null ? fmtTime(h) : null);

export function sunTimesTool(args: SunTimesArgs) {
  const date = parseDate(args.date);
  const st = getSunTimes(args.lat, args.lon, date, args.timezone, 0);
  return {
    date: date.toISOString().slice(0, 10),
    timesIn: args.timezone ?? "UTC",
    polar: st.polar,
    sunrise: t(st.sunrise),
    sunset: t(st.sunset),
    solarNoon: t(st.solarNoon),
    civilDawn: t(st.civilDawn),
    civilDusk: t(st.civilDusk),
    goldenHourEvening: st.goldenEveningStart !== null && st.sunset !== null
      ? { start: t(st.goldenEveningStart), end: t(st.sunset) }
      : null,
    dayLengthMinutes: Math.round(st.dayLengthMin),
    dayLengthChangeVsYesterdayMinutes: Math.round(st.dayLengthDeltaMin),
  };
}

// ---------------------------------------------------------------------------
// get_vitamin_d_window

export interface VitDArgs {
  lat: number;
  lon: number;
  date?: string;
  timezone?: string;
  /** Fitzpatrick skin type 1–6. */
  skinType?: number;
  /** Fraction of skin exposed: 0.10 face+hands, 0.18 face+arms, 0.25 t-shirt+shorts, 0.40 swimsuit. */
  exposedSkinFraction?: number;
  age?: number;
  targetIU?: number;
  elevationM?: number;
}

function normalizeProfile(args: VitDArgs) {
  const skinType = Math.min(6, Math.max(1, Math.round(args.skinType ?? 3))) as SkinType;
  const area = Math.min(1, Math.max(0.05, args.exposedSkinFraction ?? 0.25));
  const targetIU = Math.min(10000, Math.max(100, args.targetIU ?? 1000));
  const age = args.age !== undefined ? Math.min(120, Math.max(0, args.age)) : null;
  const elevationM = Math.min(6000, Math.max(-100, args.elevationM ?? 0));
  return { skinType, area, targetIU, age, elevationM };
}

export function vitaminDWindowTool(args: VitDArgs) {
  const date = parseDate(args.date);
  const doy = dayOfYear(date);
  const { skinType, area, targetIU, age, elevationM } = normalizeProfile(args);
  const curve = getCurve(args.lat, args.lon, doy, 0, args.timezone);
  const ctx = { ozoneDu: ozoneDU(args.lat, args.lon, doy), elevationM };
  const result = computeExposureFromCurve(curve, skinType, area, targetIU, age, ctx);

  const base = {
    date: date.toISOString().slice(0, 10),
    timesIn: args.timezone ?? "UTC",
    profile: { skinType, exposedSkinFraction: area, age, targetIU },
    note: DISCLAIMER,
  };
  if (!result) {
    return {
      ...base,
      synthesisPossible: false as const,
      reason: `Clear-sky UV never reaches index ${MIN_UVI} that day at this location; the skin cannot produce meaningful vitamin D. Diet or supplementation are the alternatives.`,
    };
  }
  return {
    ...base,
    synthesisPossible: true as const,
    window: { start: `${result.windowStart}:00`, end: `${result.windowEnd}:00` },
    bestHour: `${result.bestHour}:00`,
    peakClearSkyUVIndex: Math.round(result.bestUVI * 10) / 10,
    minutesNeededAtBestHour: Math.round(result.minutesNeeded),
    maxSessionIU: Math.round(result.maxIU),
    targetCapped: result.targetCapped,
  };
}

// ---------------------------------------------------------------------------
// get_vitamin_d_year

const monthDay = (doy: number) => {
  const d = dateFromDoy(doy);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The whole year in one call — the answer to "which months can I make
 * vitamin D in <place>?" without a per-date call cascade. Month possibility
 * comes from the same threshold model as the SEO city pages; the per-month
 * windows/minutes use the caller's personal profile (mid-month sample).
 */
export function vitaminDYearTool(args: Omit<VitDArgs, "date">) {
  const { skinType, area, targetIU, age, elevationM } = normalizeProfile(args);
  const profile = cityYearProfile(args.lat, args.lon, elevationM);
  const bounds = profile.allYear || profile.neverPossible
    ? null
    : viableDateBoundaries(profile.hoursByDay);

  const byMonth = Array.from({ length: 12 }, (_, m) => {
    const doy = dayOfYear(new Date(2026, m, 15));
    const curve = getCurve(args.lat, args.lon, doy, 0, args.timezone);
    const exposure = computeExposureFromCurve(curve, skinType, area, targetIU, age, {
      ozoneDu: ozoneDU(args.lat, args.lon, doy),
      elevationM,
    });
    return exposure
      ? {
          month: m + 1,
          synthesisPossible: true,
          window: { start: `${exposure.windowStart}:00`, end: `${exposure.windowEnd}:00` },
          minutesNeededAtBestHour: Math.round(exposure.minutesNeeded),
        }
      : { month: m + 1, synthesisPossible: false, window: null, minutesNeededAtBestHour: null };
  });

  return {
    timesIn: args.timezone ?? "UTC",
    profile: { skinType, exposedSkinFraction: area, age, targetIU },
    allYear: profile.allYear,
    neverPossible: profile.neverPossible,
    possibleMonths: profile.possibleMonths,
    impossibleMonths: profile.impossibleMonths,
    exactViableSpan: bounds
      ? { firstDay: monthDay(bounds.startDoy), lastDay: monthDay(bounds.endDoy), format: "MM-DD, any year" }
      : null,
    byMonth,
    note: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// get_current_status

export type WeatherFetcher = (lat: number, lon: number) => Promise<WeatherHour[] | null>;

const UPSTREAM_TIMEOUT_MS = 5000;

/** Today's hourly UV/clouds from Open-Meteo; null on any failure (the caller
 *  falls back to the clear-sky model — same policy as the app's UI). */
export const fetchWeatherHours: WeatherFetcher = async (lat, lon) => {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("hourly", "uv_index,cloud_cover");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.hourly?.time) return null;
    return data.hourly.time.map((time: string, i: number) => ({
      time,
      uvIndex: data.hourly.uv_index?.[i] ?? 0,
      cloudCover: data.hourly.cloud_cover?.[i] ?? 0,
    }));
  } catch {
    return null;
  }
};

export async function currentStatusTool(args: VitDArgs, fetcher: WeatherFetcher = fetchWeatherHours) {
  const now = new Date();
  const doy = dayOfYear(now);
  const { skinType, area, targetIU, age, elevationM } = normalizeProfile(args);
  const curve = getCurve(args.lat, args.lon, doy, 0, args.timezone);
  const ctx = { ozoneDu: ozoneDU(args.lat, args.lon, doy), elevationM };

  const hours = await fetcher(args.lat, args.lon);
  const status = getCurrentStatus(
    hours ? { hours } : null, curve, skinType, area, targetIU, age, now, args.timezone, ctx,
  );

  return {
    timesIn: args.timezone ?? "UTC",
    uvSource: hours ? "open-meteo forecast (includes clouds)" : "clear-sky model (no cloud data)",
    profile: { skinType, exposedSkinFraction: area, age, targetIU },
    state: status.state,
    currentUVIndex: Math.round(status.effectiveUVI * 10) / 10,
    minutesNeededNow: status.minutesNeeded !== null ? Math.round(status.minutesNeeded) : null,
    window: status.window ? { start: `${status.window.start}:00`, end: `${status.window.end}:00` } : null,
    bestHour: status.bestHour !== null ? `${status.bestHour}:00` : null,
    minutesUntilWindow: status.minutesUntilWindow,
    windowClosesInMinutes: status.windowClosesIn,
    cloudCoverPercent: status.cloudCover,
    maxSessionIU: Math.round(maxSessionIU(area, age)),
    note: DISCLAIMER,
  };
}
