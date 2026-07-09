import { vitDHrs, getCurve, dateFromDoy } from "./solar";
import { MIN_UVI_ELEVATION, computeExposureFromCurve, type SkinType } from "./vitd";

// Defaults used for the public page copy (Fitzpatrick III, arms+face, 1000 IU).
const DEFAULT_SKIN: SkinType = 3;
const DEFAULT_AREA = 0.25;
const DEFAULT_TARGET_IU = 1000;

/** March equinox, June solstice, September equinox, December solstice. */
export const REPRESENTATIVE_DOYS = [80, 172, 264, 355];

export interface CityYearProfile {
  /** vitDHrs for doy 1..365 at this latitude. */
  hoursByDay: number[];
  /** 1-12, months where synthesis is possible on most days. */
  possibleMonths: number[];
  /** 1-12, the complement of possibleMonths. */
  impossibleMonths: number[];
  allYear: boolean;
  neverPossible: boolean;
}

/**
 * Year-round synthesis profile for a latitude. A month counts as "possible" when
 * synthesis is achievable on at least half of its days — that keeps shoulder
 * months (a handful of viable days) out of the headline claim.
 */
export function cityYearProfile(lat: number): CityYearProfile {
  const hoursByDay = Array.from({ length: 365 }, (_, i) => vitDHrs(lat, i + 1, MIN_UVI_ELEVATION));

  const daysPerMonth = Array.from({ length: 12 }, () => 0);
  const possibleDaysPerMonth = Array.from({ length: 12 }, () => 0);
  for (let doy = 1; doy <= 365; doy++) {
    const monthIndex = dateFromDoy(doy).getMonth(); // 0-11
    daysPerMonth[monthIndex] += 1;
    if (hoursByDay[doy - 1] > 0) possibleDaysPerMonth[monthIndex] += 1;
  }

  const possibleMonths: number[] = [];
  const impossibleMonths: number[] = [];
  for (let m = 0; m < 12; m++) {
    if (possibleDaysPerMonth[m] * 2 >= daysPerMonth[m]) possibleMonths.push(m + 1);
    else impossibleMonths.push(m + 1);
  }

  return {
    hoursByDay,
    possibleMonths,
    impossibleMonths,
    allYear: impossibleMonths.length === 0,
    neverPossible: possibleMonths.length === 0,
  };
}

/**
 * Given a set of 1-12 month numbers, returns the contiguous band as {start, end},
 * wrapping across the year boundary — southern-hemisphere cities have their
 * possible months split around January (e.g. [1,2,3,4,10,11,12] → Oct–Apr).
 * Returns null when the set is empty or covers all 12 months (no band to name).
 */
export function contiguousMonthRange(months: number[]): { start: number; end: number } | null {
  if (months.length === 0 || months.length === 12) return null;
  const set = new Set(months);
  const prev = (m: number) => (m === 1 ? 12 : m - 1);
  const next = (m: number) => (m === 12 ? 1 : m + 1);

  const start = months.find((m) => !set.has(prev(m)));
  if (start === undefined) return null;

  let end = start;
  while (set.has(next(end)) && next(end) !== start) end = next(end);
  return { start, end };
}

export interface SeasonWindow {
  doy: number;
  /** 0-11, for Intl month formatting by the caller. */
  monthIndex: number;
  possible: boolean;
  windowStart: number | null;
  windowEnd: number | null;
  minutesNeeded: number | null;
}

/** Sun windows on the four representative days, using the page's default profile. */
export function citySeasonalWindows(lat: number, lon: number, tz: number): SeasonWindow[] {
  return REPRESENTATIVE_DOYS.map((doy) => {
    const curve = getCurve(lat, lon, doy, tz);
    const exposure = computeExposureFromCurve(curve, DEFAULT_SKIN, DEFAULT_AREA, DEFAULT_TARGET_IU);
    const monthIndex = dateFromDoy(doy).getMonth();

    if (!exposure || exposure.windowStart < 0 || exposure.windowEnd < 0) {
      return { doy, monthIndex, possible: false, windowStart: null, windowEnd: null, minutesNeeded: null };
    }
    return {
      doy,
      monthIndex,
      possible: true,
      windowStart: exposure.windowStart,
      windowEnd: exposure.windowEnd,
      minutesNeeded: exposure.minutesNeeded,
    };
  });
}
