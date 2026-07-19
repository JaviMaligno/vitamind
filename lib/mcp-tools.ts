import { BUILTIN_CITIES } from "./cities";
import { CITY_SLUGS } from "./city-slugs";
import { getSunTimes } from "./sun-times";
import { getCurve, dayOfYear, fmtTime, dateFromDoy } from "./solar";
import {
  computeExposureFromCurve, getCurrentStatus, maxSessionIU, MIN_UVI,
  iuForMinutes, erythemaMinutes, minutesForVitD, estimateUVFromElevation, type SkinType,
} from "./vitd";
import { ozoneDU } from "./uv-model";
import { cityYearProfile, viableDateBoundaries, MIN_VIABLE_HOURS } from "./city-content";
import type { SolarPoint, WeatherHour } from "./types";

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

/** "11:00" with zero-padded hours, for whole-hour window bounds. */
const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const fmtDayLen = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;

/** Clear-sky UV at a local hour, from the day's elevation curve. */
function uvAtLocalHour(curve: SolarPoint[], localHour: number, ctx: { ozoneDu?: number; elevationM?: number }): number {
  let best = curve[0];
  for (const p of curve) {
    if (Math.abs(p.localHours - localHour) < Math.abs(best.localHours - localHour)) best = p;
  }
  return estimateUVFromElevation(best.elevation, ctx);
}

/** "HH:MM" → decimal local hours, or null when malformed. */
function parseLocalTime(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h + min / 60;
}

export function sunTimesTool(args: SunTimesArgs) {
  const date = parseDate(args.date);
  const st = getSunTimes(args.lat, args.lon, date, args.timezone, 0);

  // Explain nulls so they read as physics, not missing data (audit finding).
  const notes: string[] = [];
  if (st.civilDawn === null && st.polar === null) {
    notes.push("No civil dawn/dusk: at this latitude and date the sun never dips 6° below the horizon (no full darkness).");
  }
  if (st.goldenMorningEnd === null && st.sunrise !== null) {
    notes.push("No distinct golden hour: the sun never climbs 6° above the horizon, so the whole day has golden-hour light.");
  }

  return {
    date: date.toISOString().slice(0, 10),
    timesIn: args.timezone ?? "UTC",
    polar: st.polar,
    sunrise: t(st.sunrise),
    sunset: t(st.sunset),
    solarNoon: t(st.solarNoon),
    civilDawn: t(st.civilDawn),
    civilDusk: t(st.civilDusk),
    goldenHourMorning: st.sunrise !== null && st.goldenMorningEnd !== null
      ? { start: t(st.sunrise), end: t(st.goldenMorningEnd) }
      : null,
    goldenHourEvening: st.goldenEveningStart !== null && st.sunset !== null
      ? { start: t(st.goldenEveningStart), end: t(st.sunset) }
      : null,
    dayLength: fmtDayLen(st.dayLengthMin),
    dayLengthMinutes: Math.round(st.dayLengthMin),
    dayLengthChangeVsYesterdayMinutes: Math.round(st.dayLengthDeltaMin),
    ...(notes.length ? { notes } : {}),
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
  /** Local "HH:MM" the user actually plans to go out (window tool only). */
  atTime?: string;
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
  // "How long AT the time I'll actually go out" (audit finding: users rarely
  // go out exactly at the best hour).
  const atHour = parseLocalTime(args.atTime);
  let atTime: { time: string; uvIndex: number; minutesNeeded: number | null; note?: string } | undefined;
  if (atHour !== null) {
    const uvi = uvAtLocalHour(curve, atHour, ctx);
    const mins = minutesForVitD(uvi, skinType, area, targetIU, age);
    atTime = {
      time: args.atTime!,
      uvIndex: Math.round(uvi * 10) / 10,
      minutesNeeded: mins !== null ? Math.round(mins) : null,
      ...(mins === null ? { note: `UV below ${MIN_UVI} at that time — no meaningful synthesis; aim for the window instead.` } : {}),
    };
  }

  return {
    ...base,
    synthesisPossible: true as const,
    window: { start: hh(result.windowStart), end: hh(result.windowEnd) },
    bestHour: hh(result.bestHour),
    peakClearSkyUVIndex: Math.round(result.bestUVI * 10) / 10,
    minutesNeededAtBestHour: Math.round(result.minutesNeeded),
    ...(atTime ? { atTime } : {}),
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

  // ONE criterion everywhere (audit fix): a day is viable when it offers at
  // least MIN_VIABLE_HOURS of usable sun — the same floor the exact span uses.
  // Months are then described by their count of viable days, so season-edge
  // months read as "partial" instead of contradicting the span.
  const viable = profile.hoursByDay.map((h) => h >= MIN_VIABLE_HOURS);

  const byMonth = Array.from({ length: 12 }, (_, m) => {
    const startDoy = dayOfYear(new Date(2026, m, 1));
    const daysInMonth = new Date(2026, m + 1, 0).getDate();
    const doys = Array.from({ length: daysInMonth }, (_, i) => startDoy + i);
    const viableDoys = doys.filter((d) => viable[d - 1]);

    // Sample a representative viable day (the 15th when it qualifies, else the
    // middle of the month's viable stretch) for the window and minutes.
    const mid = startDoy + 14;
    const sampleDoy = viableDoys.length === 0
      ? null
      : viableDoys.includes(mid) ? mid : viableDoys[Math.floor(viableDoys.length / 2)];

    let window: { start: string; end: string } | null = null;
    let minutesNeededAtBestHour: number | null = null;
    if (sampleDoy !== null) {
      const curve = getCurve(args.lat, args.lon, sampleDoy, 0, args.timezone);
      const exposure = computeExposureFromCurve(curve, skinType, area, targetIU, age, {
        ozoneDu: ozoneDU(args.lat, args.lon, sampleDoy),
        elevationM,
      });
      if (exposure) {
        window = { start: hh(exposure.windowStart), end: hh(exposure.windowEnd) };
        minutesNeededAtBestHour = Math.round(exposure.minutesNeeded);
      }
    }

    return {
      month: m + 1,
      synthesisPossible: viableDoys.length > 0,
      viableDays: viableDoys.length,
      partialMonth: viableDoys.length > 0 && viableDoys.length < daysInMonth,
      window,
      minutesNeededAtBestHour,
    };
  });

  const viableDaysPerYear = viable.filter(Boolean).length;
  const monthsWithSun = byMonth.filter((m) => m.synthesisPossible).map((m) => m.month);
  const sampled = byMonth.filter((m) => m.minutesNeededAtBestHour !== null);
  const bestMonth = sampled.length
    ? sampled.reduce((a, b) => (b.minutesNeededAtBestHour! < a.minutesNeededAtBestHour! ? b : a)).month
    : null;

  return {
    timesIn: args.timezone ?? "UTC",
    profile: { skinType, exposedSkinFraction: area, age, targetIU },
    allYear: profile.allYear,
    neverPossible: profile.neverPossible,
    /** Months with at least one viable day — season-edge months included. */
    monthsWithSun,
    /** Months where most days are viable (the headline claim the app uses). */
    solidMonths: profile.possibleMonths,
    exactViableSpan: bounds
      ? { firstDay: monthDay(bounds.startDoy), lastDay: monthDay(bounds.endDoy), format: "MM-DD, any year" }
      : null,
    summary: {
      viableDaysPerYear,
      seasonLengthDays: profile.allYear ? 365 : viableDaysPerYear,
      bestMonth,
      minutesAtBestMonth: bestMonth ? byMonth[bestMonth - 1].minutesNeededAtBestHour : null,
    },
    byMonth,
    note: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// estimate_sun_session

const ERYTHEMA_NOTE =
  "Sunburn time is a clear-sky erythema estimate for unprotected skin; sunscreen, shade and clouds change it completely. Not medical advice.";

export interface SessionArgs extends Omit<VitDArgs, "atTime" | "targetIU"> {
  /** Local "HH:MM" the session starts (defaults to the day's best hour). */
  startTime?: string;
  /** Session length in minutes. */
  minutes: number;
}

/**
 * The inverse question ("I was out N minutes — how much vitamin D did I
 * make?") plus the safety one ("how long before I burn?"), both from the same
 * models the app uses (audit finding: assistants were doing this math by hand).
 */
export function estimateSunSessionTool(args: SessionArgs) {
  const date = parseDate(args.date);
  const doy = dayOfYear(date);
  const { skinType, area, age, elevationM } = normalizeProfile({ ...args, targetIU: undefined });
  const minutes = Math.min(600, Math.max(1, Math.round(args.minutes)));
  const curve = getCurve(args.lat, args.lon, doy, 0, args.timezone);
  const ctx = { ozoneDu: ozoneDU(args.lat, args.lon, doy), elevationM };

  // Default to the day's best hour when no start time is given.
  let startHour = parseLocalTime(args.startTime);
  if (startHour === null) {
    const exposure = computeExposureFromCurve(curve, skinType, area, 1000, age, ctx);
    startHour = exposure ? exposure.bestHour : 12;
  }

  // UV averaged over the session (start / middle / end samples), so a session
  // straddling the afternoon decline isn't rated at its starting intensity.
  const samples = [startHour, startHour + minutes / 120, startHour + minutes / 60]
    .map((h) => uvAtLocalHour(curve, Math.min(24, h), ctx));
  const uvi = samples.reduce((a, b) => a + b, 0) / samples.length;

  const estimatedIU = Math.round(iuForMinutes(minutes, uvi, skinType, area, age));
  const burn = erythemaMinutes(uvi, skinType);
  const burnMinutes = burn !== null && burn <= 600 ? Math.round(burn) : null;

  return {
    date: date.toISOString().slice(0, 10),
    timesIn: args.timezone ?? "UTC",
    profile: { skinType, exposedSkinFraction: area, age },
    session: { start: args.startTime ?? hh(Math.round(startHour)), minutes },
    averageUVIndex: Math.round(uvi * 10) / 10,
    estimatedIU,
    ...(uvi < MIN_UVI ? { lowUvNote: `UV below ${MIN_UVI} during this session — vitamin D synthesis is negligible.` } : {}),
    maxSessionIU: Math.round(maxSessionIU(area, age)),
    sunburn: {
      minutesToSunburn: burnMinutes,
      sessionExceedsIt: burnMinutes !== null ? minutes >= burnMinutes : false,
      ...(burnMinutes === null ? { note: "UV too low for a practical sunburn-time estimate." } : {}),
    },
    note: `${DISCLAIMER} ${ERYTHEMA_NOTE}`,
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

  // Window over for today (or none at all): point at tomorrow's clear-sky
  // window so the assistant can answer "when's my next chance" without guessing.
  let nextWindow: { date: string; start: string; end: string } | null = null;
  if (status.state === "window_closed" || status.state === "no_synthesis") {
    const tomorrowDoy = doy >= 365 ? 1 : doy + 1;
    const tomorrowCurve = getCurve(args.lat, args.lon, tomorrowDoy, 0, args.timezone);
    const exposure = computeExposureFromCurve(tomorrowCurve, skinType, area, targetIU, age, {
      ozoneDu: ozoneDU(args.lat, args.lon, tomorrowDoy),
      elevationM,
    });
    if (exposure) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      nextWindow = { date: tomorrow.toISOString().slice(0, 10), start: hh(exposure.windowStart), end: hh(exposure.windowEnd) };
    }
  }

  return {
    timesIn: args.timezone ?? "UTC",
    uvSource: hours ? "open-meteo forecast (includes clouds)" : "clear-sky model (no cloud data)",
    profile: { skinType, exposedSkinFraction: area, age, targetIU },
    state: status.state,
    currentUVIndex: Math.round(status.effectiveUVI * 10) / 10,
    minutesNeededNow: status.minutesNeeded !== null ? Math.round(status.minutesNeeded) : null,
    window: status.window ? { start: hh(status.window.start), end: hh(status.window.end) } : null,
    bestHour: status.bestHour !== null ? hh(status.bestHour) : null,
    minutesUntilWindow: status.minutesUntilWindow,
    windowClosesInMinutes: status.windowClosesIn,
    ...(nextWindow ? { nextWindow } : {}),
    cloudCoverPercent: status.cloudCover,
    maxSessionIU: Math.round(maxSessionIU(area, age)),
    note: DISCLAIMER,
  };
}
