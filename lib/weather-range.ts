import type { WeatherHour } from "./types";

/**
 * Hourly UV and cloud cover for a date range, past or future.
 *
 * Open-Meteo splits this across two hosts: the forecast endpoint carries roughly
 * a week of history, and anything older lives in the archive. Which one to ask
 * was decided inside `app/api/weather/route.ts`; it lives here now so the MCP
 * server can reconstruct a past day without duplicating the rule — and so that
 * when the cutoff moves, it moves once.
 */

const UPSTREAM_TIMEOUT_MS = 8000;

/**
 * How far back the forecast endpoint accepts a `start_date`.
 *
 * This used to say seven, which sent every older day to the archive — and the
 * archive has no `uv_index` at all. It answered with nulls, those became zeros,
 * and a fortnight in London came back as a fortnight with no sun. The forecast
 * host serves UV much further back than a week, so ask it first.
 *
 * Its UV coverage is shorter than this window and the edge moves, so no caller
 * may assume a reading exists: see `hoursFromPayload`.
 */
export const FORECAST_PAST_DAYS = 92;

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

/** The archive host for anything older than a week, the forecast host otherwise. */
export function endpointFor(startDate: string, now: Date = new Date()): string {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cutoff = today - FORECAST_PAST_DAYS * 86400000;
  return Date.parse(`${startDate}T00:00:00Z`) < cutoff ? ARCHIVE_URL : FORECAST_URL;
}

export function rangeUrl(lat: number, lon: number, from: string, to: string, now?: Date): string {
  const url = new URL(endpointFor(from, now));
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "uv_index,cloud_cover");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  return url.toString();
}

/**
 * The `hourly` block Open-Meteo returns, flattened into our own shape.
 *
 * An hour with no UV reading is **dropped, not zeroed**. Zero is a claim — that
 * the sun was not up — and the archive returns nulls for every hour of every
 * day, so zeroing them reported a fortnight of London summer as a fortnight of
 * darkness. A caller left with no hours falls back to the clear-sky model and
 * says it did; a caller handed a zero cannot tell the difference.
 */
export function hoursFromPayload(data: unknown): WeatherHour[] | null {
  const hourly = (data as { hourly?: Record<string, unknown> } | null)?.hourly;
  const times = hourly?.time;
  if (!Array.isArray(times)) return null;
  const uv = Array.isArray(hourly?.uv_index) ? hourly.uv_index : [];
  const cloud = Array.isArray(hourly?.cloud_cover) ? hourly.cloud_cover : [];
  const hours: WeatherHour[] = [];
  times.forEach((time: string, i: number) => {
    if (typeof uv[i] !== "number") return;
    hours.push({
      time,
      uvIndex: uv[i] as number,
      // Cloud cover may genuinely be absent while UV is not; zero is a safe
      // reading there because the UV already carries the attenuation.
      cloudCover: typeof cloud[i] === "number" ? (cloud[i] as number) : 0,
    });
  });
  return hours.length ? hours : null;
}

export type WeatherRangeFetcher = (
  lat: number, lon: number, from: string, to: string,
) => Promise<WeatherHour[] | null>;

/** Null on any failure; every caller falls back to the clear-sky model and says so. */
export const fetchWeatherRange: WeatherRangeFetcher = async (lat, lon, from, to) => {
  try {
    const res = await fetch(rangeUrl(lat, lon, from, to), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return hoursFromPayload(await res.json());
  } catch {
    return null;
  }
};
