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

const MIN_UVI = 3; // Below this, no meaningful vitamin D synthesis

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
 * Minutes needed to synthesize target IU of vitamin D.
 * Based on Holick's Rule: 1/4 MED over 25% body ≈ 1000 IU
 * Formula: time = target_IU * MED[skin] / (24000 * areaFraction * uvi * ageFactor)
 */
export function minutesForVitD(
  uvi: number,
  skinType: SkinType,
  areaFraction: number,
  targetIU: number = 1000,
  age: number | null = null,
): number | null {
  if (uvi < MIN_UVI) return null; // No synthesis possible
  const med = MED[skinType];
  const af = ageFactor(age);
  const time = (targetIU * med) / (24000 * areaFraction * uvi * af);
  // Cap at 1/3 MED time (diminishing returns beyond this)
  const maxUseful = med / (4.5 * uvi);
  return Math.min(time, maxUseful);
}

/**
 * Find the best hour and compute exposure info from weather data.
 */
export interface ExposureResult {
  bestHour: number;        // Local hour with highest UVI
  bestUVI: number;         // UV index at best hour
  minutesNeeded: number;   // Minutes for target IU
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

  return { bestHour, bestUVI, minutesNeeded, windowStart, windowEnd, hourlyMinutes };
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

  return { bestHour, bestUVI, minutesNeeded, windowStart, windowEnd, hourlyMinutes };
}
