import type { WeatherHour, SolarPoint, NowStatus } from "./types";
import { hourFromTimeString } from "./timezone";

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
 * Solar elevation (degrees) where clear-sky UVI reaches MIN_UVI.
 * Inverse of the Madronich model used in estimateUVFromElevation().
 * Used by heatmap/worldmap as the UV-based threshold for synthesis hours.
 */
export const MIN_UVI_ELEVATION = (() => {
  const sinE = Math.pow(MIN_UVI / 12, 1 / 1.3);
  return Math.asin(sinE) * (180 / Math.PI);
})(); // ~19.1 degrees

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
  bestHour: number;        // Local hour with highest UVI
  bestUVI: number;         // UV index at best hour
  minutesNeeded: number;   // Minutes for target IU
  maxIU: number;           // Max IU achievable per session
  targetCapped: boolean;   // True if target exceeds safe max
  windowStart: number;     // First hour with UVI >= 3
  windowEnd: number;       // Last hour with UVI >= 3
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
 * Simplified Madronich model: UVI ≈ 12 * sin(elevation)^1.3 at sea level.
 * This ignores clouds, ozone, altitude — gives a "typical clear sky" estimate.
 */
export function estimateUVFromElevation(elevationDeg: number): number {
  if (elevationDeg <= 0) return 0;
  const sinElev = Math.sin((elevationDeg * Math.PI) / 180);
  return 12 * Math.pow(sinElev, 1.3);
}

/**
 * Compute exposure estimate from solar curve (no weather data needed).
 * Uses theoretical clear-sky UV. Labeled as "estimacion teorica".
 */
export function computeExposureFromCurve(
  curve: SolarPoint[],
  skinType: SkinType,
  areaFraction: number,
  targetIU: number = 1000,
  age: number | null = null,
): ExposureResult | null {
  const hourlyMinutes: ExposureResult["hourlyMinutes"] = [];
  let bestUVI = 0;
  let bestHour = 12;
  let windowStart = -1;
  let windowEnd = -1;

  // Sample one point per hour from the curve
  for (let h = 0; h < 24; h++) {
    const pt = curve.find((p) => Math.floor(p.localHours) === h);
    const elev = pt?.elevation ?? 0;
    const uvi = estimateUVFromElevation(elev);
    const mins = minutesForVitD(uvi, skinType, areaFraction, targetIU, age);
    hourlyMinutes.push({ hour: h, uvi, minutes: mins });

    if (uvi >= MIN_UVI) {
      if (windowStart === -1) windowStart = h;
      windowEnd = h + 1;
    }
    if (uvi > bestUVI) {
      bestUVI = uvi;
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

  // Build hourly UVI + cloud data
  const hourlyUVI: { hour: number; uvi: number; cloud: number }[] = [];

  if (weather && weather.hours.length > 0) {
    for (const wh of weather.hours) {
      hourlyUVI.push({ hour: hourFromTimeString(wh.time), uvi: wh.uvIndex, cloud: wh.cloudCover });
    }
  } else if (curve.length > 0) {
    for (let h = 0; h < 24; h++) {
      const pt = curve.find((p) => Math.floor(p.localHours) === h);
      const elev = pt?.elevation ?? 0;
      hourlyUVI.push({ hour: h, uvi: estimateUVFromElevation(elev), cloud: 0 });
    }
  }

  if (hourlyUVI.length === 0) {
    return {
      state: "no_synthesis", currentUVI: 0, effectiveUVI: 0, intensity: null,
      minutesNeeded: null, window: null, bestHour: null, bestMinutes: null,
      minutesUntilWindow: null, windowClosesIn: null, cloudCover: null, cloudDegraded: false,
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

  // Compute effective UVI per hour for window detection
  const effectiveHourly = hourlyUVI.map((h) => ({
    hour: h.hour,
    effectiveUVI: useCloudFactor ? h.uvi * cloudFactor(h.cloud) : h.uvi,
    rawUVI: h.uvi,
  }));

  // Find synthesis window
  let wsStart = -1;
  let wsEnd = -1;
  let bHour: number | null = null;
  let bEffUVI = 0;

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

  const synthWindow = wsStart !== -1 ? { start: wsStart, end: wsEnd } : null;
  const bMinutes = bHour !== null
    ? minutesForVitD(bEffUVI, skinType, areaFraction, targetIU, age)
    : null;

  // cloudDegraded only meaningful with theoretical curve — with real API data,
  // UVI already reflects clouds so there's no "theoretical vs effective" gap
  const theoreticalWindow = hourlyUVI.some((h) => h.uvi >= MIN_UVI);
  const cloudDegraded = useCloudFactor && theoreticalWindow && synthWindow === null;
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
  } else if (synthWindow && currentHour >= synthWindow.start && currentHour < synthWindow.end) {
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
  } else if (synthWindow && currentHour < synthWindow.start) {
    state = "upcoming";
    minutesUntilWindow = (synthWindow.start - currentHour) * 60 - currentMinutes;
  } else if (synthWindow && currentHour >= synthWindow.end) {
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
    minutesUntilWindow, windowClosesIn, cloudCover: currentCloud, cloudDegraded,
  };
}
