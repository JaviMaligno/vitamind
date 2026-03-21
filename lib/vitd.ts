import type { WeatherHour, SolarPoint } from "./types";

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
    const d = new Date(wh.time);
    const h = d.getHours();
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
