import { BUILTIN_CITIES } from "./cities";
import { CITY_SLUGS } from "./city-slugs";
import { getSunTimes } from "./sun-times";
import { getCurve, dayOfYear, fmtTime, fmtDayLength, dateFromDoy, doyFromMonthDay, daysInMonth, solarElev } from "./solar";
import { solarPhase, type SolarPhase } from "./solar-phase";
import {
  computeExposureFromCurve, getCurrentStatus, maxSessionIU, MIN_UVI,
  iuForMinutes, erythemaMinutes, minutesForVitD, estimateUVFromElevation, type SkinType,
} from "./vitd";
import { ozoneDU } from "./uv-model";
import { inferElevationM } from "./elevation";
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

/**
 * Midday UTC, not midday local: the day number is a UTC convention (see
 * lib/solar.ts), so parsing "2026-07-15" in the server's zone made the tools
 * answer for the 14th on a machine east of Greenwich.
 */
function parseDate(date?: string): Date {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(`${date}T12:00:00Z`);
  return new Date();
}

const t = (h: number | null) => (h !== null ? fmtTime(h) : null);

/** "11:00" with zero-padded hours, for whole-hour window bounds. */
const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`;


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
    dayLength: fmtDayLength(st.dayLengthMin),
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
  /** How the user named the place; only used to caption a widget. */
  placeName?: string;
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

  // An explicit elevation always wins — a caller who says 0 means 0. Only when
  // it is missing do we look it up from the coordinates, because the caller is a
  // language model and it omits the field whenever it filled lat/lon from memory
  // instead of calling search_city. Sea level is the wrong guess for Madrid and
  // a bad one for Bogotá.
  const inferred = args.elevationM === undefined ? inferElevationM(args.lat, args.lon) : null;
  const elevationM = Math.min(6000, Math.max(-100, args.elevationM ?? inferred ?? 0));

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
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

/**
 * The whole year in one call — the answer to "which months can I make
 * vitamin D in <place>?" without a per-date call cascade. Month possibility
 * comes from the same threshold model as the SEO city pages; the per-month
 * windows/minutes use the caller's personal profile (mid-month sample).
 */
function buildVitaminDYearResult(
  args: Omit<VitDArgs, "date">,
  normalized: ReturnType<typeof normalizeProfile>,
  profile: ReturnType<typeof cityYearProfile>,
) {
  const { skinType, area, targetIU, age, elevationM } = normalized;
  const bounds = profile.allYear || profile.neverPossible
    ? null
    : viableDateBoundaries(profile.hoursByDay);

  // ONE criterion everywhere (audit fix): a day is viable when it offers at
  // least MIN_VIABLE_HOURS of usable sun — the same floor the exact span uses.
  // Months are then described by their count of viable days, so season-edge
  // months read as "partial" instead of contradicting the span.
  const viable = profile.hoursByDay.map((h) => h >= MIN_VIABLE_HOURS);

  const byMonth = Array.from({ length: 12 }, (_, m) => {
    const startDoy = doyFromMonthDay(m, 1);
    const doys = Array.from({ length: daysInMonth(m) }, (_, i) => startDoy + i);
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
      partialMonth: viableDoys.length > 0 && viableDoys.length < daysInMonth(m),
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

export function vitaminDYearTool(args: Omit<VitDArgs, "date">) {
  const normalized = normalizeProfile(args);
  const profile = cityYearProfile(args.lat, args.lon, normalized.elevationM);
  return buildVitaminDYearResult(args, normalized, profile);
}

export function vitaminDYearFull(args: Omit<VitDArgs, "date">) {
  const normalized = normalizeProfile(args);
  const profile = cityYearProfile(args.lat, args.lon, normalized.elevationM);
  return { text: buildVitaminDYearResult(args, normalized, profile), hoursByDay: profile.hoursByDay };
}

// ---------------------------------------------------------------------------
// configure_sun_profile

export interface ProfileArgs {
  lat?: number;
  lon?: number;
  timezone?: string;
  placeName?: string;
  skinType?: number;
  exposedSkinFraction?: number;
  age?: number;
  targetIU?: number;
}

/** UV a reference clear day offers at noon, when no place is known yet. */
const REFERENCE_UVI = 6;

/**
 * The profile every other tool silently assumes.
 *
 * Skin type 3, a quarter of the skin exposed, adult, 1000 IU: four defaults that
 * change every number this server returns and that the user never sees. The
 * widget makes them visible and adjustable; the text below states them for
 * clients that cannot render it, which is the point of saying them out loud.
 */
export function configureSunProfileFull(args: ProfileArgs) {
  // normalizeProfile only reads the four profile fields; the coordinates are
  // optional here because the picker is useful before a place is chosen.
  const { skinType, area, targetIU, age } = normalizeProfile({ lat: 0, lon: 0, ...args });

  let uvIndex = REFERENCE_UVI;
  if (typeof args.lat === "number" && typeof args.lon === "number") {
    const doy = dayOfYear(new Date());
    const curve = getCurve(args.lat, args.lon, doy, 0, args.timezone);
    const peak = curve.reduce((best, p) => (p.elevation > best.elevation ? p : best), curve[0]);
    uvIndex = Math.round(estimateUVFromElevation(peak.elevation, {
      ozoneDu: ozoneDU(args.lat, args.lon, doy),
      elevationM: 0,
    }) * 10) / 10;
  }

  const minutes = minutesForVitD(uvIndex, skinType, area, targetIU, age);

  return {
    text: {
      profile: { skinType, exposedSkinFraction: area, age, targetIU },
      usingDefaultsFor: [
        args.skinType === undefined ? "skinType" : null,
        args.exposedSkinFraction === undefined ? "exposedSkinFraction" : null,
        args.age === undefined ? "age" : null,
        args.targetIU === undefined ? "targetIU" : null,
      ].filter(Boolean),
      referenceUVIndex: uvIndex,
      ...(args.placeName ? { place: args.placeName } : {}),
      minutesAtThatUV: minutes === null ? null : Math.round(minutes),
      hint: "These four values change every other answer. The user can adjust them in the widget; whatever they choose comes back into the conversation, and later tool calls should pass those values explicitly.",
      note: DISCLAIMER,
    },
    chart: {
      profile: { skinType, exposedSkinFraction: area, age, targetIU },
      uvIndex,
      ...(args.placeName ? { placeName: args.placeName } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// compare_vitamin_d_year

export interface ComparePlace {
  name: string;
  lat: number;
  lon: number;
  timezone?: string;
  elevationM?: number;
}

export type CompareArgs = Omit<VitDArgs, "date" | "lat" | "lon" | "elevationM"> & { places: ComparePlace[] };

/**
 * Several places, one call, one picture.
 *
 * A separate tool rather than letting the model call get_vitamin_d_year N times:
 * each tool call renders its own view, so N calls give N unrelated widgets. A
 * comparison only means anything when the years share an axis, and that requires
 * the data to arrive together.
 */
export function compareVitaminDYearFull(args: CompareArgs) {
  const places = args.places.slice(0, 5);
  const perPlace = places.map((place) => {
    const full = vitaminDYearFull({
      lat: place.lat,
      lon: place.lon,
      timezone: place.timezone,
      elevationM: place.elevationM,
      skinType: args.skinType,
      exposedSkinFraction: args.exposedSkinFraction,
      age: args.age,
      targetIU: args.targetIU,
    });
    return { place, ...full };
  });

  const text = {
    profile: perPlace[0]?.text.profile,
    places: perPlace.map(({ place, text: year }) => ({
      name: place.name,
      monthsWithSun: year.monthsWithSun,
      solidMonths: year.solidMonths,
      exactViableSpan: year.exactViableSpan,
      viableDaysPerYear: year.summary.viableDaysPerYear,
      bestMonth: year.summary.bestMonth,
      minutesAtBestMonth: year.summary.minutesAtBestMonth,
    })),
    // Spelled out so the model does not have to re-derive the ranking and get it
    // wrong; ties keep the caller's order.
    rankedByViableDays: perPlace
      .map(({ place, text: year }) => ({ name: place.name, viableDaysPerYear: year.summary.viableDaysPerYear }))
      .sort((a, b) => b.viableDaysPerYear - a.viableDaysPerYear)
      .map((r) => r.name),
    note: DISCLAIMER,
  };

  return {
    text,
    chart: {
      places: perPlace.map(({ place, text: year, hoursByDay }) => ({
        name: place.name,
        hoursByDay,
        spanStart: year.exactViableSpan?.firstDay,
        spanEnd: year.exactViableSpan?.lastDay,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// get_sun_forecast

/** One day of the outlook: what the sun offers and whether it is worth going out. */
export interface ForecastDaySummary {
  date: string;
  peakUVIndex: number;
  avgCloudPercent: number;
  window: { start: string; end: string } | null;
  minutesNeededAtBestHour: number | null;
  synthesisPossible: boolean;
}

/** Groups Open-Meteo's flat hourly list into local calendar days. */
function groupByDay(hours: WeatherHour[]): Map<string, WeatherHour[]> {
  const byDay = new Map<string, WeatherHour[]>();
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const bucket = byDay.get(date);
    if (bucket) bucket.push(h);
    else byDay.set(date, [h]);
  }
  return byDay;
}

/**
 * The next few days, so "which day this week should I go out?" has an answer.
 *
 * Everything else here answers for one day. Someone planning a walk, or waiting
 * out a cloudy stretch, is asking across days — and until now the only way to
 * serve them was to call the single-day tool once per date, which is exactly the
 * cascade the year tool's description tells the model not to do.
 *
 * Uses the live forecast, not the clear-sky model: the whole point of looking
 * ahead is the weather. Without it there is nothing to say that the solar
 * geometry does not already say.
 */
export async function sunForecastFull(
  args: Omit<VitDArgs, "date"> & { days?: number },
  fetcher: WeatherFetcher = fetchWeatherHours,
) {
  const requested = Math.min(7, Math.max(2, Math.round(args.days ?? 5)));
  const { skinType, area, targetIU, age } = normalizeProfile(args);
  const hours = await fetcher(args.lat, args.lon, requested);

  if (!hours) {
    return {
      text: {
        error: "forecast_unavailable",
        hint: "The weather provider did not answer. get_vitamin_d_window still gives the clear-sky answer for a specific date.",
      },
      chart: null,
    };
  }

  const days: ForecastDaySummary[] = [];
  for (const [date, dayHours] of groupByDay(hours)) {
    if (days.length >= requested) break;

    // The window comes from the FORECAST's hourly UV, not from the clear-sky
    // curve. Open-Meteo's UV already has the cloud cover in it, which is the
    // only reason this tool beats the geometry: a day under 74% cloud must not
    // report the same window and the same minutes as a clear one.
    let peak = 0;
    let start = -1;
    let end = -1;
    for (const h of dayHours) {
      const uvi = h.uvIndex ?? 0;
      const hour = Number(h.time.slice(11, 13));
      if (uvi > peak) peak = uvi;
      if (uvi >= MIN_UVI) {
        if (start < 0) start = hour;
        end = hour + 1;
      }
    }

    const avgCloud = dayHours.length
      ? Math.round(dayHours.reduce((sum, h) => sum + (h.cloudCover ?? 0), 0) / dayHours.length)
      : 0;
    const possible = start >= 0;
    const minutes = possible ? minutesForVitD(peak, skinType, area, targetIU, age) : null;

    days.push({
      date,
      peakUVIndex: Math.round(peak * 10) / 10,
      avgCloudPercent: avgCloud,
      window: possible ? { start: hh(start), end: hh(end) } : null,
      minutesNeededAtBestHour: minutes === null ? null : Math.round(minutes),
      synthesisPossible: possible,
    });
  }

  const usable = days.filter((d) => d.synthesisPossible);
  // Spelled out so the model does not re-derive it from the list and slip.
  const best = usable.length
    ? usable.reduce((a, b) => (b.peakUVIndex > a.peakUVIndex ? b : a)).date
    : null;

  return {
    text: {
      timesIn: args.timezone ?? "UTC",
      profile: { skinType, exposedSkinFraction: area, age, targetIU },
      daysAhead: days.length,
      bestDay: best,
      daysWithSun: usable.length,
      days,
      source: "open-meteo forecast (UV and cloud cover)",
      note: DISCLAIMER,
    },
    chart: { days, bestDay: best },
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

export type WeatherFetcher = (lat: number, lon: number, days?: number) => Promise<WeatherHour[] | null>;

const UPSTREAM_TIMEOUT_MS = 5000;

/** Today's hourly UV/clouds from Open-Meteo; null on any failure (the caller
 *  falls back to the clear-sky model — same policy as the app's UI). */
export const fetchWeatherHours: WeatherFetcher = async (lat, lon, days = 1) => {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("hourly", "uv_index,cloud_cover");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", String(Math.min(7, Math.max(1, Math.round(days)))));
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

/**
 * Shared body for the two entry points below, so the widget's chart data comes
 * out of the SAME computation the text answer does — the curve is 289 solar
 * evaluations plus a weather fetch, and doing that twice per call to decorate a
 * picture would be indefensible.
 */
/**
 * The solar phase at a location right now, the same way `useSolarPhase` does it
 * in the app: elevation now, against elevation ten minutes ago to tell a rising
 * sun from a setting one.
 */
function currentSolarPhase(lat: number, lon: number, doy: number, now: Date): SolarPhase {
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const elev = solarElev(lat, lon, doy, utcH);
  const before = solarElev(lat, lon, doy, utcH - 1 / 6);
  return solarPhase(elev, elev >= before);
}

async function buildCurrentStatus(args: VitDArgs, fetcher: WeatherFetcher) {
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

  const text = {
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

  return {
    text,
    // What the app's own "My Day" hero puts on screen, and nothing else. It
    // deliberately does NOT send the elevation curve: the curve answers "what
    // shape does this day have", which is the explore screen's question, not
    // "should I go outside now". See #29.
    chart: {
      state: status.state,
      intensity: status.intensity,
      // The sky the app would be painting at those coordinates right now. Only
      // the server knows the hour there, and the widget has no clock it can
      // trust — the iframe runs in the reader's zone, not the location's.
      phase: currentSolarPhase(args.lat, args.lon, doy, now),
      uvIndex: text.currentUVIndex,
      minutesNeeded: text.minutesNeededNow,
      windowStart: status.window ? status.window.start : null,
      windowEnd: status.window ? status.window.end : null,
      minutesUntilWindow: status.minutesUntilWindow,
      windowClosesInMinutes: status.windowClosesIn,
      bestHour: status.bestHour,
      bestMinutes: status.bestMinutes === null ? null : Math.round(status.bestMinutes),
      cloudCoverPercent: status.cloudCover,
      cloudDegraded: status.cloudDegraded,
    },
  };
}

/** The tool's answer for the model: unchanged, text only. */
export async function currentStatusTool(args: VitDArgs, fetcher: WeatherFetcher = fetchWeatherHours) {
  return (await buildCurrentStatus(args, fetcher)).text;
}

/** Same answer plus the chart channel the MCP App widget renders from. */
export async function currentStatusFull(args: VitDArgs, fetcher: WeatherFetcher = fetchWeatherHours) {
  return buildCurrentStatus(args, fetcher);
}
