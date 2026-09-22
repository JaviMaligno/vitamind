import type { WeatherHour, SolarPoint, NowStatus } from "./types";
import { hourFromTimeString } from "./timezone";
import { uvIndex, minElevationForUVI, OZONE_REFERENCE_DU } from "@/lib/uv-model";

/**
 * Where and when the clear-sky estimate applies. Defaults: reference ozone
 * (300 DU), sea level. Supplying a place's real ozone column (via
 * `ozoneDU(lat, lon, doy)`) and altitude makes the estimate location-accurate.
 */
export interface ClearSkyContext {
  ozoneDu?: number;
  elevationM?: number;
}

export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;

// Minimal Erythemal Dose by Fitzpatrick skin type (J/m²)
// Sources: Holick 2007 NEJM, Dowdy et al. 2010
const MED: Record<SkinType, number> = {
  1: 200,
  2: 250,
  3: 300,
  4: 450,
  5: 750,
  6: 1200,
};

export const SKIN_LABELS: Record<SkinType, string> = {
  1: "I — Muy clara, siempre se quema",
  2: "II — Clara, se quema facilmente",
  3: "III — Media, a veces se quema",
  4: "IV — Oliva, rara vez se quema",
  5: "V — Morena, muy rara vez",
  6: "VI — Oscura, nunca se quema",
};

export const AREA_PRESETS: { label: string; value: number }[] = [
  { label: "Cara + manos (10%)", value: 0.10 },
  { label: "Cara + brazos (18%)", value: 0.18 },
  { label: "Camiseta + short (25%)", value: 0.25 },
  { label: "Banador (40%)", value: 0.40 },
];

export const MIN_UVI = 3; // Below this, no meaningful vitamin D synthesis

/**
 * Reference solar elevation (degrees) at which clear-sky UVI reaches MIN_UVI,
 * evaluated at sea level under the 300 DU reference ozone column (≈33.68°).
 *
 * This is a REFERENCE value only. The real threshold is not a single constant:
 * it varies with latitude, season (ozone) and altitude, ranging from about
 * 29.3° to 41.7° across the plausible range. Callers that know a place and a
 * day should call `synthesisThresholdElevation(lat, lon, doy, elevationM)`
 * from `@/lib/uv-model` instead of using this constant.
 */
export const MIN_UVI_ELEVATION = minElevationForUVI(MIN_UVI, OZONE_REFERENCE_DU, 0);

/**
 * Reference values for target IU presets.
 * Based on IOM/Endocrine Society recommendations:
 * - 400 IU: minimum daily for children/infants
 * - 1000 IU: common adult recommendation (Holick/Endocrine Society)
 * - 2000 IU: upper range common supplementation
 * - 4000 IU: high-end supplementation dose
 *
 * Note: the IOM Tolerable Upper Intake Level (4000 IU/day) applies to
 * oral supplementation. Solar synthesis is self-limiting via photodegradation
 * of previtamin D3 — toxicity from sun exposure is not possible.
 * Higher targets require longer exposure and approach erythemal (sunburn) risk.
 */
export const TARGET_IU_PRESETS: { value: number; labelKey: string }[] = [
  { value: 400, labelKey: "targetPreset400" },
  { value: 1000, labelKey: "targetPreset1000" },
  { value: 2000, labelKey: "targetPreset2000" },
  { value: 4000, labelKey: "targetPreset4000" },
];

/**
 * Age adjustment factor for vitamin D synthesis.
 * Holick 1989: ~50% decrease from age 20 to 80.
 * Returns multiplier >= 0.5 (conservative floor).
 */
export function ageFactor(age: number | null): number {
  if (age === null || age <= 20) return 1.0;
  return Math.max(0.5, 1.0 - 0.013 * (age - 20));
}

/**
 * Maximum IU achievable in a single session before photodegradation
 * cancels net production. Based on Holick (1982): 1 MED full-body ≈
 * 10,000–25,000 IU. We use the Holick's Rule constant (24,000 IU at
 * 1 MED full-body) scaled by 0.8 to account for photodegradation
 * losses at sustained exposure.
 *
 * Sources:
 * - Holick MF, 1982 (J Clin Endocrinol Metab)
 * - de Gruijl et al., 2016 (Photochem Photobiol Sci): net production
 *   drops to ~zero after 7.5 SED due to previtamin D3 → lumisterol/tachysterol
 */
export function maxSessionIU(
  areaFraction: number,
  age: number | null = null,
): number {
  const af = ageFactor(age);
  // 0.8 * 24000 = 19200 IU for full body 1 MED, scaled by area and age
  // Photodegradation ceiling is melanin-independent — skinType not needed
  return 19200 * areaFraction * af;
}

/**
 * Minutes of exposure to reach 1 MED (erythema onset) at a given UVI — the
 * same med/uvi approximation minutesForVitD already uses internally as its
 * safety cap, exposed for "how long before I burn" answers. Returns null when
 * UV is negligible (no practical erythema risk to time).
 */
export function erythemaMinutes(uvi: number, skinType: SkinType): number | null {
  if (uvi <= 0.1) return null;
  return MED[skinType] / uvi;
}

/**
 * Minutes needed to synthesize target IU of vitamin D.
 *
 * Uses a saturating exponential model that accounts for photodegradation:
 *   IU(t) = IU_sat * (1 - exp(-R * t / IU_sat))
 * Inverting:
 *   t = -IU_sat/R * ln(1 - targetIU/IU_sat)
 *
 * At sub-erythemal doses (< ~1/3 MED), this is effectively linear
 * (matching Holick's Rule), confirmed by PNAS 2021 in-vivo study
 * (Young et al., n=75).
 *
 * Beyond 1/3 MED, diminishing returns from photodegradation of
 * previtamin D3 to lumisterol/tachysterol (de Gruijl et al., 2016).
 *
 * Hard cap at 1 MED time (erythemal limit) to prevent burn risk.
 *
 * Returns minutes needed (capped at 1 MED for safety), or null if UVI < 3.
 * The `targetCapped` flag is computed externally in computeExposure() via ExposureResult.
 */
export function minutesForVitD(
  uvi: number,
  skinType: SkinType,
  areaFraction: number,
  targetIU: number = 1000,
  age: number | null = null,
): number | null {
  if (uvi < MIN_UVI) return null;
  const med = MED[skinType];
  const af = ageFactor(age);

  // Linear production rate (IU per minute) — Holick's Rule
  const R = (24000 * areaFraction * uvi * af) / med;

  // Saturation ceiling: max IU achievable per session
  const iuSat = maxSessionIU(areaFraction, age);

  // Safety ceiling: 1 MED time (prevent erythema/burns)
  const medTimeMin = med / uvi; // minutes to reach 1 MED

  if (targetIU >= iuSat) {
    // Target is unreachable — return the MED time as ceiling
    return medTimeMin;
  }

  // Saturating exponential: t = -(IU_sat / R) * ln(1 - target / IU_sat)
  const tau = iuSat / R; // characteristic time constant
  const time = -tau * Math.log(1 - targetIU / iuSat);

  // Cap at 1 MED time for safety
  return Math.min(time, medTimeMin);
}

/**
 * IU synthesized for a given exposure time (minutes).
 * Saturating exponential model (inverse of minutesForVitD).
 */
export function iuForMinutes(
  minutes: number,
  uvi: number,
  skinType: SkinType,
  areaFraction: number,
  age: number | null = null,
): number {
  if (uvi < MIN_UVI || minutes <= 0) return 0;
  const med = MED[skinType];
  const af = ageFactor(age);
  const R = (24000 * areaFraction * uvi * af) / med;
  const iuSat = maxSessionIU(areaFraction, age);
  const tau = iuSat / R;
  return iuSat * (1 - Math.exp(-minutes / tau));
}

/**
 * Find the best hour and compute exposure info from weather data.
 */
export interface ExposureResult {
  /**
   * Local time of peak UVI, as a fractional hour (12.75 = 12:45). Whole hours
   * from `computeExposure`, whose input is hourly; the curve's own resolution
   * from `computeExposureFromCurve`. Format it with `fmtTime`, never `${h}:00`.
   */
  bestHour: number;
  bestUVI: number;         // UV index at best hour
  minutesNeeded: number;   // Minutes for target IU
  maxIU: number;           // Max IU achievable per session
  targetCapped: boolean;   // True if target exceeds safe max
  /** Fractional local hour the window opens. See `bestHour` on formatting. */
  windowStart: number;
  /** Fractional local hour the window closes. See `bestHour` on formatting. */
  windowEnd: number;
  hourlyMinutes: { hour: number; uvi: number; minutes: number | null }[];
}

export function computeExposure(
  hours: WeatherHour[],
  skinType: SkinType,
  areaFraction: number,
  targetIU: number = 1000,
  age: number | null = null,
): ExposureResult | null {
  if (!hours.length) return null;

  const hourlyMinutes: ExposureResult["hourlyMinutes"] = [];
  let bestUVI = 0;
  let bestHour = 12;
  let windowStart = -1;
  let windowEnd = -1;

  for (const wh of hours) {
    const h = hourFromTimeString(wh.time);
    const mins = minutesForVitD(wh.uvIndex, skinType, areaFraction, targetIU, age);
    hourlyMinutes.push({ hour: h, uvi: wh.uvIndex, minutes: mins });

    if (wh.uvIndex >= MIN_UVI) {
      if (windowStart === -1) windowStart = h;
      windowEnd = h + 1;
    }

    if (wh.uvIndex > bestUVI) {
      bestUVI = wh.uvIndex;
      bestHour = h;
    }
  }

  if (bestUVI < MIN_UVI) return null;

  const minutesNeeded = minutesForVitD(bestUVI, skinType, areaFraction, targetIU, age);
  if (minutesNeeded === null) return null;

  const maxIU = maxSessionIU(areaFraction, age);
  const targetCapped = targetIU >= maxIU;

  return { bestHour, bestUVI, minutesNeeded, maxIU, targetCapped, windowStart, windowEnd, hourlyMinutes };
}

/**
 * Estimate clear-sky UV index from solar elevation angle.
 *
 * Delegates entirely to the Madronich (2007) analytic clear-sky UVI formula
 * (`uvIndex` in `@/lib/uv-model`), which uses UVI = 12.5 * sin(elev)^2.42 *
 * (Omega/300)^-1.23 with an altitude gain factor. The optional `ctx` supplies
 * the ozone column (Dobson Units) and observer altitude (metres); it defaults
 * to the 300 DU reference column at sea level.
 *
 * This is a clear-sky estimate: it ignores clouds and aerosols.
 */
export function estimateUVFromElevation(elevationDeg: number, ctx: ClearSkyContext = {}): number {
  return uvIndex(elevationDeg, ctx.ozoneDu, ctx.elevationM);
}

/**
 * The clear-sky window a solar curve actually contains, at the curve's own
 * resolution.
 *
 * WHY THIS IS NOT A LOOP OVER 24 CLOCK HOURS, WHICH IS WHAT IT USED TO BE.
 * `getCurve` returns a point every five minutes. This function used to keep one
 * point in twelve — the one at `h:00` — and answer from those 24 samples. Two
 * things followed, and neither is a rounding error:
 *
 *   1. A WINDOW THAT CONTAINED NO CLOCK HOUR WAS REPORTED AS NO WINDOW AT ALL.
 *      Near the edges of the season the window narrows to under an hour, and
 *      whether it survived depended on where solar noon happened to fall
 *      relative to the clock — a property of the city's longitude inside its
 *      timezone, not of its sun. Measured over the 73 built-in cities × 365
 *      days: 80 city-days where a real window was reported as none, across 36
 *      cities. Casablanca loses 19 days a year, Phoenix 18.
 *
 *      The reason this matters more than 0.39% suggests: the dose is ~19 min at
 *      UVI 3 for the page's default reader. A 35-minute window is not a
 *      technicality, it is a usable one, and it was being thrown away for
 *      arithmetic reasons on precisely the days a reader most needs the answer.
 *
 *   2. THE EDGES WERE WRONG BY UP TO AN HOUR ON EVERY OTHER DAY. Mean error
 *      0.47 h on the start and 0.55 h on the end, max a full hour. London on
 *      22 September: the real span is 11:45-14:00 and the page said 12:00-15:00
 *      — an hour of synthesis advertised after the UV had already dropped
 *      through the threshold.
 *
 * `hourlyMinutes` stays one row per clock hour on purpose: it is the day-curve
 * chart's data, and a chart of hours wants hours. Only the window bounds and
 * the peak, which are instants, are read at full resolution.
 */
export function computeExposureFromCurve(
  curve: SolarPoint[],
  skinType: SkinType,
  areaFraction: number,
  targetIU: number = 1000,
  age: number | null = null,
  ctx: ClearSkyContext = {},
): ExposureResult | null {
  const hourlyMinutes: ExposureResult["hourlyMinutes"] = [];

  // One row per clock hour, for the chart.
  for (let h = 0; h < 24; h++) {
    const pt = curve.find((p) => Math.floor(p.localHours) === h);
    const uvi = estimateUVFromElevation(pt?.elevation ?? 0, ctx);
    hourlyMinutes.push({ hour: h, uvi, minutes: minutesForVitD(uvi, skinType, areaFraction, targetIU, age) });
  }

  // The window and the peak, from every point the curve has.
  let bestUVI = 0;
  let bestHour = 12;
  let windowStart = -1;
  let windowEnd = -1;
  for (const p of curve) {
    const uvi = estimateUVFromElevation(p.elevation, ctx);
    if (uvi >= MIN_UVI) {
      if (windowStart === -1) windowStart = p.localHours;
      // The last instant still above the threshold — not the end of the clock
      // hour containing it, which is what overshot the close by up to an hour.
      windowEnd = p.localHours;
    }
    if (uvi > bestUVI) {
      bestUVI = uvi;
      bestHour = p.localHours;
    }
  }

  if (bestUVI < MIN_UVI) return null;

  const minutesNeeded = minutesForVitD(bestUVI, skinType, areaFraction, targetIU, age);
  if (minutesNeeded === null) return null;

  const maxIU = maxSessionIU(areaFraction, age);
  const targetCapped = targetIU >= maxIU;

  return { bestHour, bestUVI, minutesNeeded, maxIU, targetCapped, windowStart, windowEnd, hourlyMinutes };
}

/**
 * Linear interpolation over hourly points, flat outside their range, 1 when
 * there are none.
 *
 * Both ratios in `getCurrentStatus` — the calibration onto the forecast's
 * clear-sky scale and the transmission through its clouds — are hourly series
 * read at the ephemeris's five-minute resolution. One implementation, so they
 * cannot drift apart.
 */
function lerpByHour(points: { hour: number; ratio: number }[], localHour: number): number {
  if (points.length === 0) return 1;
  if (localHour <= points[0].hour) return points[0].ratio;
  const last = points[points.length - 1];
  if (localHour >= last.hour) return last.ratio;
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    if (b.hour < localHour) continue;
    const a = points[i - 1];
    const span = b.hour - a.hour;
    return span === 0 ? b.ratio : a.ratio + (b.ratio - a.ratio) * ((localHour - a.hour) / span);
  }
  return last.ratio;
}

/**
 * Cloud cover penalty factor for effective UVI.
 * Reduces UVI based on cloud cover percentage from Open-Meteo.
 */
export function cloudFactor(cloudCover: number): number {
  if (cloudCover <= 20) return 1.0;
  if (cloudCover <= 50) return 0.7;
  if (cloudCover <= 80) return 0.4;
  return 0.15;
}

/**
 * Linearly interpolate UVI between two hourly values.
 */
function interpolateUVI(uviCurrent: number, uviNext: number, minutesFraction: number): number {
  return uviCurrent + (uviNext - uviCurrent) * minutesFraction;
}

/**
 * Compute real-time "now" status from weather data or solar curve.
 * Determines if the current moment is good for synthesis, and if not, when the next window is.
 */
export function getCurrentStatus(
  weather: { hours: WeatherHour[] } | null,
  curve: SolarPoint[],
  skinType: SkinType,
  areaFraction: number,
  targetIU: number,
  age: number | null,
  now: Date,
  timezone?: string,
  ctx: ClearSkyContext = {},
): NowStatus {
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
    if (currentHour === 24) currentHour = 0;
  } else {
    currentHour = now.getHours();
    currentMinutes = now.getMinutes();
  }
  const minutesFraction = currentMinutes / 60;
  /** The exact local instant, so a fractional window bound can be compared to it. */
  const nowHour = currentHour + minutesFraction;

  // Build hourly UVI + cloud data
  const hourlyUVI: { hour: number; uvi: number; cloud: number }[] = [];

  /** The forecast's own clear-sky reading per hour, where it supplied one. */
  const forecastClearSky = new Map<number, number>();
  if (weather && weather.hours.length > 0) {
    for (const wh of weather.hours) {
      const h = hourFromTimeString(wh.time);
      hourlyUVI.push({ hour: h, uvi: wh.uvIndex, cloud: wh.cloudCover });
      if (typeof wh.uvIndexClearSky === "number" && wh.uvIndexClearSky > 0) {
        forecastClearSky.set(h, wh.uvIndexClearSky);
      }
    }
  }

  /**
   * What the SUN alone offers today, from the solar curve — computed whether or
   * not there is weather, because it is the reference the forecast is judged
   * against.
   *
   * This used to be built only in the `else` branch above, i.e. only when there
   * was NO weather data, which is what made `cloudDegraded` dead code: in that
   * branch the "theoretical" hours were the same hours the window was derived
   * from (cloud is hardcoded to 0 there, so `cloudFactor` is a no-op), and in
   * the weather branch there was no clear-sky reference at all. The flag could
   * therefore never be true in either, and a reader standing under a bright sky
   * was told the UV index was too low instead of that the forecast saw cloud.
   */
  // Hourly rows, which is what the interpolation below and the no-weather
  // fallback both want.
  const clearSkyHourly: { hour: number; uvi: number }[] = [];
  if (curve.length > 0) {
    for (let h = 0; h < 24; h++) {
      const pt = curve.find((p) => Math.floor(p.localHours) === h);
      const elev = pt?.elevation ?? 0;
      clearSkyHourly.push({ hour: h, uvi: estimateUVFromElevation(elev, ctx) });
    }
  }

  // No weather: the clear-sky curve IS the reading, cloud unknown (hence 0).
  if (!weather) {
    for (const h of clearSkyHourly) hourlyUVI.push({ hour: h.hour, uvi: h.uvi, cloud: 0 });
  }

  /**
   * CALIBRATION: our clear-sky curve rescaled onto the forecast's clear-sky
   * values, hour by hour, interpolated in between.
   *
   * `uv_index_clear_sky` is the same model that produced `uv_index`, with the
   * clouds removed. Using it as the reference is what makes "the sun would
   * allow a window from X to Y" a statement backed by the forecast's own
   * physics rather than by ours — and ours is the one running on a 1979 ozone
   * climatology that disagrees with it by up to a factor of two.
   *
   * It is hourly, so the curve still supplies the shape within the hour. One
   * factor for the absolute scale, one ephemeris for the shape; the same split
   * the attenuation below uses, and for the same reason.
   *
   * With no forecast, or a forecast that omitted the field, the factor is 1 and
   * this is the model's own answer — which is also what the city and hub pages
   * publish, so the fallback is consistent rather than merely safe.
   */
  const calibrationPoints: { hour: number; ratio: number }[] = [];
  for (const cs of clearSkyHourly) {
    const theirs = forecastClearSky.get(cs.hour);
    if (theirs !== undefined && cs.uvi >= 0.5) calibrationPoints.push({ hour: cs.hour, ratio: theirs / cs.uvi });
  }
  const calibratedClearSky = (localHour: number, modelUVI: number) =>
    modelUVI * lerpByHour(calibrationPoints, localHour);

  const clearSkySource: NowStatus["clearSkySource"] =
    calibrationPoints.length > 0 ? "forecast" : "model";

  // The BOUNDS come from every point the curve has, for the reason spelled out
  // on `computeExposureFromCurve`: a sub-hour window that contains no clock
  // hour is a real window, and sampling on the hour cannot see it.
  let csStart = -1;
  let csEnd = -1;
  for (const p of curve) {
    const clear = calibratedClearSky(p.localHours, estimateUVFromElevation(p.elevation, ctx));
    if (clear >= MIN_UVI) {
      if (csStart === -1) csStart = p.localHours;
      csEnd = p.localHours;
    }
  }
  const clearSkyWindow = csStart !== -1 ? { start: csStart, end: csEnd } : null;

  if (hourlyUVI.length === 0) {
    return {
      state: "no_synthesis", currentUVI: 0, effectiveUVI: 0, intensity: null,
      minutesNeeded: null, window: null, bestHour: null, bestMinutes: null,
      minutesUntilWindow: null, windowClosesIn: null, cloudCover: null,
      clearSkyWindow, clearSkySource, cloudDegraded: false,
    };
  }

  // Interpolate current UVI between hour boundaries
  const curr = hourlyUVI.find((h) => h.hour === currentHour);
  const next = hourlyUVI.find((h) => h.hour === currentHour + 1);
  const rawUVI = curr
    ? next
      ? interpolateUVI(curr.uvi, next.uvi, minutesFraction)
      : curr.uvi
    : 0;
  const currentCloud = curr?.cloud ?? null;

  // Open-Meteo UVI already accounts for cloud cover — only apply cloudFactor
  // when using theoretical clear-sky curve (no weather data)
  const useCloudFactor = !weather;
  const cf = useCloudFactor && currentCloud !== null ? cloudFactor(currentCloud) : 1.0;
  const effectiveUVI = rawUVI * cf;

  // Compute effective UVI per hour (the forecast's own resolution).
  const effectiveHourly = hourlyUVI.map((h) => ({
    hour: h.hour,
    effectiveUVI: useCloudFactor ? h.uvi * cloudFactor(h.cloud) : h.uvi,
    rawUVI: h.uvi,
  }));

  /**
   * ATTENUATION PER HOUR: how much of the clear sky is getting through.
   *
   * This is the ratio that lets an hourly forecast be read at the curve's
   * resolution without inventing anything. The two inputs have very different
   * natures and the split follows it exactly:
   *
   *   - The SUN's contribution is known to the minute. `curve` is a five-minute
   *     ephemeris; nothing about it is uncertain between one hour and the next.
   *   - The SKY's contribution is what the forecast supplies hourly, and it is
   *     the slowly-varying part. Interpolating cloud between 12:00 and 13:00 is
   *     an ordinary thing to do; interpolating the SUN's position would not be,
   *     because we already know it exactly.
   *
   * So the ratio is interpolated and the curve carries the shape. A useful
   * property falls out: because it is a RATIO, a bias in our own clear-sky model
   * cancels. Where Open-Meteo and `uvIndex` disagree on the absolute number —
   * and they do, by up to a factor of two at high sun (see docs/uv-sources.md) —
   * the result still tracks Open-Meteo's values, with our curve supplying only
   * the within-the-hour shape.
   *
   * Ratios are taken only where the clear-sky value is large enough to divide
   * by. Near sunrise it is not, and it does not matter: the window threshold is
   * MIN_UVI, far above that end of the curve.
   */
  const RATIO_FLOOR_UVI = 0.5;
  const transmissionPoints: { hour: number; ratio: number }[] = [];
  if (weather) {
    for (const cs of clearSkyHourly) {
      const observed = effectiveHourly.find((h) => h.hour === cs.hour);
      if (!observed) continue;
      // Prefer the forecast's OWN clear-sky reading as the denominator: same
      // model, same grid cell, same hour, so the quotient is transmission and
      // nothing else. Falling back to ours mixes two models into one number and
      // calls the difference cloud.
      const theirClear = forecastClearSky.get(cs.hour);
      const reference = theirClear ?? cs.uvi;
      if (reference < RATIO_FLOOR_UVI) continue;
      transmissionPoints.push({ hour: cs.hour, ratio: observed.effectiveUVI / reference });
    }
  }

  // The effective curve, at the ephemeris's resolution.
  let wsStart = -1;
  let wsEnd = -1;
  let bHour: number | null = null;
  let bEffUVI = 0;
  for (const p of curve) {
    const clear = calibratedClearSky(p.localHours, estimateUVFromElevation(p.elevation, ctx));
    const eff = weather ? clear * lerpByHour(transmissionPoints, p.localHours) : clear;
    if (eff >= MIN_UVI) {
      if (wsStart === -1) wsStart = p.localHours;
      wsEnd = p.localHours;
      if (eff > bEffUVI) {
        bEffUVI = eff;
        bHour = p.localHours;
      }
    }
  }

  /**
   * Fall back to the hourly reading when there is no curve to read — the MCP
   * and the widgets can call this with weather and an empty ephemeris.
   */
  if (curve.length === 0) {
    for (const h of effectiveHourly) {
      if (h.effectiveUVI >= MIN_UVI) {
        if (wsStart === -1) wsStart = h.hour;
        wsEnd = h.hour + 1;
        if (h.effectiveUVI > bEffUVI) {
          bEffUVI = h.effectiveUVI;
          bHour = h.hour;
        }
      }
    }
  }

  const synthWindow = wsStart !== -1 ? { start: wsStart, end: wsEnd } : null;
  const bMinutes = bHour !== null
    ? minutesForVitD(bEffUVI, skinType, areaFraction, targetIU, age)
    : null;

  // The sun would allow it, the sky does not. Judged against `clearSkyWindow`,
  // which comes from the solar curve rather than from `hourlyUVI` — with real
  // API data those hours ARE the cloud-attenuated ones, so comparing them with
  // themselves is what made this flag permanently false.
  const cloudDegraded = clearSkyWindow !== null && synthWindow === null;
  // Whether some later hour is still worth waiting for, cloud included.
  const theoreticalWindow = hourlyUVI.some((h) => h.uvi >= MIN_UVI);
  const minutesNeededNow = minutesForVitD(effectiveUVI, skinType, areaFraction, targetIU, age);

  // Determine state
  let state: NowStatus["state"];
  let intensity: NowStatus["intensity"] = null;
  let minutesUntilWindow: number | null = null;
  let windowClosesIn: number | null = null;

  if (effectiveUVI >= MIN_UVI) {
    state = "good_now";
    intensity = effectiveUVI > 5 ? "optimal" : "moderate";
    if (synthWindow) {
      windowClosesIn = (synthWindow.end - currentHour) * 60 - currentMinutes;
      if (windowClosesIn < 0) windowClosesIn = 0;
    }
  } else if (synthWindow && nowHour >= synthWindow.start && nowHour < synthWindow.end) {
    // Inside window period but interpolated UVI dipped below threshold (e.g. cloud or transition)
    // Check if the current hour itself still has good UVI (interpolation with next hour may dip
    // but the hour's reported UVI is still valid for synthesis)
    const currHourData = effectiveHourly.find((h) => h.hour === currentHour);
    if (currHourData && currHourData.effectiveUVI >= MIN_UVI) {
      state = "good_now";
      intensity = currHourData.effectiveUVI > 5 ? "optimal" : "moderate";
      windowClosesIn = (synthWindow.end - currentHour) * 60 - currentMinutes;
      if (windowClosesIn < 0) windowClosesIn = 0;
    } else {
      // Current hour genuinely below threshold — scan forward for next good hour
      const nextGood = effectiveHourly.find((h) => h.hour > currentHour && h.hour < synthWindow.end && h.effectiveUVI >= MIN_UVI);
      if (nextGood) {
        state = "upcoming";
        minutesUntilWindow = (nextGood.hour - currentHour) * 60 - currentMinutes;
      } else {
        state = "window_closed";
      }
    }
  } else if (synthWindow && nowHour < synthWindow.start) {
    state = "upcoming";
    minutesUntilWindow = (synthWindow.start - currentHour) * 60 - currentMinutes;
  } else if (synthWindow && nowHour >= synthWindow.end) {
    state = "window_closed";
  } else if (!synthWindow && theoreticalWindow) {
    const futureGood = effectiveHourly.find((h) => h.hour > currentHour && h.effectiveUVI >= MIN_UVI);
    if (futureGood) {
      state = "upcoming";
      minutesUntilWindow = (futureGood.hour - currentHour) * 60 - currentMinutes;
    } else {
      state = "no_synthesis";
    }
  } else {
    state = "no_synthesis";
  }

  return {
    state, currentUVI: rawUVI, effectiveUVI, intensity,
    minutesNeeded: minutesNeededNow, window: synthWindow, bestHour: bHour, bestMinutes: bMinutes,
    minutesUntilWindow, windowClosesIn, cloudCover: currentCloud,
    clearSkyWindow, clearSkySource, cloudDegraded,
  };
}
