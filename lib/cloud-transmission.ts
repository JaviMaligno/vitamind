import type { WeatherHour } from "./types";
import { hoursFromPayload } from "./weather-range";
import { solarElev, dayOfYear } from "./solar";

/**
 * How much of a clear sky's UV the forecast cloud lets through, taken from the
 * MEDIAN of five models' forecast irradiance instead of from one model's UV.
 *
 * WHY. Open-Meteo's `uv_index` is one model's opinion of the cloud — in the UK,
 * the Met Office's. On 2026-09-22 it forecast 61-89% cloud over London all day,
 * every run, under a sky Heathrow reported as clear, and the app said there was
 * no window. Measured afterwards against ground stations (10 DWD, 5 NOAA
 * SURFRAD, one year, day-ahead), on the clear-sky index GHI / GHI_clear:
 *
 *   median of these five   0.123 Germany   0.119 USA   (mean abs error)
 *   ECMWF alone            0.134           0.131
 *   best_match (was used)  0.144           0.156
 *
 * No zone or season effect: weights fitted on one continent came out the same
 * on the other and did not beat the plain median. And the UV that cloud lets
 * through tracks that irradiance ratio almost exactly — measured UVB at the five
 * SURFRAD stations gives a fitted exponent of 1.04 — so the ratio is used as is.
 * On measured UV the median (day-ahead) beat Open-Meteo's own uv/uv_clear
 * (short lead): 0.133 vs 0.154 error, no bias against +0.04. docs/cloud-forecast.md.
 *
 * Only the TRANSMISSION comes from here. The clear-sky UV stays Open-Meteo's
 * `uv_index_clear_sky`, which is what `getCurrentStatus` already calibrates on.
 */

/** The five models whose irradiance forecasts are pooled. Order is the URL's. */
export const CLOUD_MODELS = [
  "ukmo_seamless",
  "meteofrance_seamless",
  "ecmwf_ifs025",
  "icon_seamless",
  "gfs_seamless",
] as const;

/** Fewer than this many models answering for an hour, and the hour keeps Open-Meteo's own UV. */
export const MIN_MODELS = 3;

/**
 * Below this clear-sky irradiance (W/m²) the ratio is dominated by noise and
 * says nothing useful; the UV there is far under the synthesis threshold anyway.
 */
const MIN_CLEAR_GHI = 50;

/** Hours between the stamp of an Open-Meteo hourly value and the centre of the hour it describes. */
const STAMP_LAG_H = 0.5;

/** Haurwitz (1945) clear-sky global irradiance, W/m² — the reference the backtest used. */
export function clearSkyGHI(elevationDeg: number): number {
  if (elevationDeg <= 0) return 0;
  const s = Math.sin((elevationDeg * Math.PI) / 180);
  return 1098 * s * Math.exp(-0.057 / s);
}

/** The five-model irradiance request for the same place and dates as `base`. */
export function radiationUrl(base: URL): string {
  const url = new URL(base.toString());
  url.searchParams.set("hourly", "shortwave_radiation");
  url.searchParams.set("models", CLOUD_MODELS.join(","));
  return url.toString();
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Median transmission per local time stamp, from a `models=` irradiance payload.
 * Hours without enough models, or with the sun too low, are simply absent.
 */
export function transmissionFromPayload(data: unknown, lat: number, lon: number): Map<string, number> | null {
  const d = data as { utc_offset_seconds?: number; hourly?: Record<string, unknown> } | null;
  const times = d?.hourly?.time;
  if (!Array.isArray(times)) return null;
  const series = CLOUD_MODELS.map((m) => d!.hourly![`shortwave_radiation_${m}`]).filter(Array.isArray) as unknown[][];
  const offsetH = (d!.utc_offset_seconds ?? 0) / 3600;
  const out = new Map<string, number>();
  times.forEach((time: string, i: number) => {
    const values = series.map((s) => s[i]).filter((v): v is number => typeof v === "number");
    if (values.length < MIN_MODELS) return;
    // Local stamp -> UTC instant at the centre of the hour the values describe.
    const centre = new Date(Date.parse(`${time}:00Z`) - (offsetH + STAMP_LAG_H) * 3600_000);
    const utcH = centre.getUTCHours() + centre.getUTCMinutes() / 60;
    const clear = clearSkyGHI(solarElev(lat, lon, dayOfYear(centre), utcH));
    if (clear < MIN_CLEAR_GHI) return;
    out.set(time, Math.min(Math.max(median(values) / clear, 0), 1));
  });
  return out;
}

/**
 * Open-Meteo's hours with the cloud replaced by the five-model median: `uvIndex`
 * becomes their clear-sky UV times the median transmission. Any hour the median
 * cannot speak for — no radiation payload, too few models, no clear-sky UV —
 * keeps Open-Meteo's own reading, so a failed second request degrades to exactly
 * the old behaviour.
 */
export function forecastHours(uvData: unknown, radiationData: unknown, lat: number, lon: number): WeatherHour[] | null {
  const hours = hoursFromPayload(uvData);
  if (!hours || radiationData == null) return hours;
  const t = transmissionFromPayload(radiationData, lat, lon);
  if (!t) return hours;
  return hours.map((h) => {
    const tr = t.get(h.time);
    if (tr === undefined || h.uvIndexClearSky === null) return h;
    return { ...h, uvIndex: h.uvIndexClearSky * tr, cloudTransmission: tr };
  });
}
