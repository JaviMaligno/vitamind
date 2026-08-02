import { computeExposure, computeExposureFromCurve, type SkinType } from "./vitd";
import { getCurve, dayOfYear } from "./solar";
import { ozoneDU } from "./uv-model";
import { fetchWeatherRange, type WeatherRangeFetcher } from "./weather-range";
import { haversineKm } from "./nearest-city";
import type { DayRecord, WeatherHour } from "./types";

/**
 * A window of days, told the way it actually was — not the way it was recorded.
 *
 * The stored record mixes two kinds of thing. Whether you went outside, and
 * where you were, only you know: those are kept. The window, the minutes and the
 * UV are a function of (date, place, profile), and freezing them means the past
 * drifts every time the profile changes — a July day in London read 53 minutes
 * because that was the profile then, next to an identical day reading 9.
 *
 * So those are derived here, from the current profile and the weather that
 * actually happened, for every day in the range rather than only the days the
 * app happened to be open.
 */

export interface HistoryWindowDay {
  date: string;
  /** Where you were. Null when nothing in the history can say. */
  cityId: string | null;
  /** The location was inherited from a neighbouring day, not recorded for this one. */
  locationAssumed: boolean;
  peakUVI: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  minutesNeeded: number | null;
  sufficient: boolean;
  /** Only ever what you declared. Never inferred from the sun. */
  wentOutside: boolean | null;
  /** Measured cloud cover, or the clear-sky model when the provider was silent. */
  uvSource: "observed" | "clear-sky";
}

export interface HistoryProfile {
  skinType: SkinType;
  area: number;
  targetIU: number;
  age: number | null;
}

export interface Place {
  lat: number;
  lon: number;
  timezone?: string;
}

/**
 * Both coordinate forms a real profile carries: `gps:lat,lon` from the device
 * and `nominatim:lat:lon` from reverse geocoding. `cityRef` knew only the
 * builtin and custom ids, so days written by either of these resolved to no
 * place at all — which is most days in production.
 */
const GPS_RE = /^(?:gps|nominatim):(-?\d+(?:\.\d+)?)[,:](-?\d+(?:\.\d+)?)$/;

export function parseGpsCityId(cityId: string): Place | null {
  const m = GPS_RE.exec(cityId);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Every YYYY-MM-DD from `from` to `to` inclusive, walked in UTC. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  let cursor = Date.parse(`${from}T00:00:00Z`);
  while (cursor <= end && out.length < 400) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86400000;
  }
  return out;
}

/**
 * A coordinate id came from the device — either raw (`gps:`) or reverse
 * geocoded from it (`nominatim:`). Anything else was picked in the app.
 */
const isMeasured = (cityId: string) => cityId.startsWith("gps:") || cityId.startsWith("nominatim:");

/**
 * Which place each date belongs to: its own record's if it has one, otherwise
 * the nearest earlier record's, and failing that the nearest later one.
 *
 * Falling backwards first is the honest default — you were somewhere before you
 * stopped opening the app, and staying put is likelier than the alternative.
 * Falling forwards only covers the leading edge, where there is no earlier day.
 *
 * What gets carried is the last *measured* location. Looking a city up in the
 * picker is the same gesture whether you live there or were merely curious, so
 * it fixes that day and nothing after it: checking Valencia once on 20 July put
 * the following six days of a London fortnight in Spain. A picked city is still
 * carried when it is all there is, which is the case for anyone who never grants
 * location permission.
 */
function locateDays(dates: string[], records: DayRecord[]): Array<{ cityId: string | null; assumed: boolean }> {
  const own = new Map(records.map((r) => [r.date, r.cityId]));
  const out: Array<{ cityId: string | null; assumed: boolean }> = [];

  let measured: string | null = null;
  let picked: string | null = null;
  for (const date of dates) {
    const mine = own.get(date);
    if (mine) {
      if (isMeasured(mine)) measured = mine;
      else picked = mine;
    }
    out.push({ cityId: mine ?? measured ?? picked, assumed: !mine });
  }

  // The leading edge: days before the first record borrow the first one going forward.
  let ahead: string | null = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].cityId) ahead = out[i].cityId;
    else if (ahead) out[i] = { cityId: ahead, assumed: true };
  }
  return out;
}

/** Hours grouped by the date they belong to, read off the local time string. */
function hoursByDate(hours: WeatherHour[]): Map<string, WeatherHour[]> {
  const map = new Map<string, WeatherHour[]>();
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const bucket = map.get(date);
    if (bucket) bucket.push(h);
    else map.set(date, [h]);
  }
  return map;
}

export interface LocationSpan {
  cityId: string | null;
  from: string;
  to: string;
  days: number;
  /** Of those days, how many inherited the place rather than recording it. */
  assumedDays: number;
}

/**
 * How far apart two coordinates may be and still count as the same place.
 *
 * The device writes four decimals, so eleven metres of drift mints a new id:
 * one real profile held `gps:51.5878,-0.0976` and `gps:51.5877,-0.0976` as
 * separate places, plus a `nominatim:` id a few hundred metres away. Compared as
 * strings, a fortnight sitting still becomes a dozen stretches.
 *
 * Twenty-five kilometres is the same figure the elevation lookup uses, and for
 * the sun's purposes anything inside it is the same place.
 */
export const SAME_PLACE_KM = 25;

/**
 * The window collapsed into stretches of "you were here".
 *
 * Where you were is a separate axis from how the day went, so it is shown
 * separately rather than folded into the grid's colours. It also cannot be a
 * per-cell marker: on real data 18 of 30 days inherit their place, and a mark on
 * 60% of the squares reads as texture. Spans are three or four.
 */
export function locationSpans(
  days: Pick<HistoryWindowDay, "date" | "cityId" | "locationAssumed">[],
  resolveCity?: (cityId: string) => Place | null,
): LocationSpan[] {
  const samePlace = (a: string | null, b: string | null): boolean => {
    if (a === b) return true;
    if (!a || !b || !resolveCity) return false;
    const pa = resolveCity(a);
    const pb = resolveCity(b);
    // Unresolvable ids fall back to comparing the ids, which is what a caller
    // without a resolver gets anyway.
    if (!pa || !pb) return false;
    return haversineKm(pa.lat, pa.lon, pb.lat, pb.lon) <= SAME_PLACE_KM;
  };

  const spans: LocationSpan[] = [];
  for (const day of days) {
    const last = spans[spans.length - 1];
    if (last && samePlace(last.cityId, day.cityId)) {
      last.to = day.date;
      last.days += 1;
      if (day.locationAssumed) last.assumedDays += 1;
    } else {
      spans.push({
        cityId: day.cityId, from: day.date, to: day.date, days: 1,
        assumedDays: day.locationAssumed ? 1 : 0,
      });
    }
  }
  return spans;
}

export async function buildHistoryWindow(opts: {
  from: string;
  to: string;
  records: DayRecord[];
  profile: HistoryProfile;
  resolveCity: (cityId: string) => Place | null;
  fetchRange?: WeatherRangeFetcher;
}): Promise<HistoryWindowDay[]> {
  const { from, to, records, profile, resolveCity, fetchRange = fetchWeatherRange } = opts;
  const dates = datesBetween(from, to);
  const located = locateDays(dates, records);
  const answers = new Map(records.map((r) => [r.date, r.userOverride]));

  // One request per location, not per day: a month spent in two cities is two
  // calls, and the common case of never moving is one.
  const spans = new Map<string, { place: Place; from: string; to: string }>();
  for (const [i, at] of located.entries()) {
    if (!at.cityId) continue;
    const place = resolveCity(at.cityId);
    if (!place) continue;
    const span = spans.get(at.cityId);
    if (span) span.to = dates[i];
    else spans.set(at.cityId, { place, from: dates[i], to: dates[i] });
  }

  const observed = new Map<string, Map<string, WeatherHour[]>>();
  await Promise.all(
    [...spans].map(async ([cityId, span]) => {
      const hours = await fetchRange(span.place.lat, span.place.lon, span.from, span.to);
      if (hours) observed.set(cityId, hoursByDate(hours));
    }),
  );

  return dates.map((date, i) => {
    const { cityId, assumed } = located[i];
    const wentOutside = answers.get(date) ?? null;
    const blank: HistoryWindowDay = {
      date, cityId, locationAssumed: cityId ? assumed : false,
      peakUVI: null, windowStart: null, windowEnd: null, minutesNeeded: null,
      sufficient: false, wentOutside, uvSource: "clear-sky",
    };

    const place = cityId ? resolveCity(cityId) : null;
    if (!place) return blank;

    const hours = cityId ? observed.get(cityId)?.get(date) : undefined;
    const doy = dayOfYear(new Date(`${date}T12:00:00Z`));
    const ctx = { ozoneDu: ozoneDU(place.lat, place.lon, doy), elevationM: 0 };

    // Measured hours when the provider answered; otherwise the clear-sky curve,
    // flagged, so a cloudy day is never quietly reported as a bright one.
    const exposure = hours?.length
      ? computeExposure(hours, profile.skinType, profile.area, profile.targetIU, profile.age)
      : computeExposureFromCurve(
        getCurve(place.lat, place.lon, doy, 0, place.timezone),
        profile.skinType, profile.area, profile.targetIU, profile.age, ctx,
      );
    if (!exposure) return blank;

    const span = exposure.windowEnd - exposure.windowStart;
    return {
      ...blank,
      uvSource: hours?.length ? "observed" : "clear-sky",
      peakUVI: Math.round(exposure.bestUVI * 10) / 10,
      windowStart: exposure.windowStart,
      windowEnd: exposure.windowEnd,
      minutesNeeded: Math.round(exposure.minutesNeeded),
      sufficient: exposure.minutesNeeded > 0 && span * 60 >= exposure.minutesNeeded,
    };
  });
}
