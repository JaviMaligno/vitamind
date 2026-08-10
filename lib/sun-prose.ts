import type { City } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";
import { dailySunTimes, getSunTimes } from "@/lib/sun-times";
import { getCurve, doyFromMonthDay, dateFromDoy } from "@/lib/solar";
import { computeExposureFromCurve } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

/**
 * The facts a sunrise page's paragraph states, computed from the same functions
 * the page's table uses.
 *
 * Structured parts rather than a sentence: the wording is translated, the facts
 * are not. And every number here is derived at render time from the model — none
 * is a constant and none is copied from other copy on the site, which is exactly
 * how the footer came to claim a 45° threshold the code abandoned in July.
 *
 * The call shape deliberately mirrors `monthData` in the month page: same
 * `dailySunTimes` for the day rows, the same 15th-of-month `getSunTimes` for the
 * snapshot, and the same `computeExposureFromCurve` arguments for the vitamin D
 * block. That is what makes the paragraph agree with the table beside it.
 */
export type Regime = "synthesis" | "none" | "polar";

export interface SunProse {
  regime: Regime;
  lat: number;
  days: number;
  firstSunrise: number | null;
  firstSunset: number | null;
  lastSunrise: number | null;
  lastSunset: number | null;
  midDayLengthMin: number | null;
  dayLengthDeltaMin: number;
  peakElevationDeg: number;
  vitD: { windowStart: number; windowEnd: number; minutesNeeded: number; bestUVI: number } | null;
}

/** Mid-range assumptions, stated so the page can state them too. */
const SKIN_TYPE: SkinType = 3;
const EXPOSED_FRACTION = 0.25;
const TARGET_IU = 1000;

/**
 * Minutes of daylight between a sunrise and a sunset expressed as local hours.
 *
 * The hours come back wrapped into 0–24, so above roughly 63° in midsummer the
 * sunset lands *after* local midnight and reads as a small number: Reykjavik on
 * 20 June sets at 00:02 and rises at 03:00, and the plain subtraction calls that
 * a day of minus three hours. Taking the difference modulo 24 gives the real
 * span. Below the sub-arctic the two agree exactly, so every treated city gets
 * the same figure its table shows.
 */
function dayLengthMin(d: { sunrise: number | null; sunset: number | null }): number | null {
  if (d.sunrise === null || d.sunset === null) return null;
  return (((d.sunset - d.sunrise) % 24 + 24) % 24) * 60;
}

export function sunProse(city: City, monthIndex: number): SunProse {
  const days = dailySunTimes(city.lat, city.lon, monthIndex, city.timezone, city.tz);
  const first = days[0];
  const last = days[days.length - 1];

  const doy15 = doyFromMonthDay(monthIndex, 15);
  const mid = getSunTimes(city.lat, city.lon, dateFromDoy(doy15), city.timezone, city.tz);
  const curve = getCurve(city.lat, city.lon, doy15, city.tz, city.timezone);
  const exposure = computeExposureFromCurve(curve, SKIN_TYPE, EXPOSED_FRACTION, TARGET_IU, null, {
    ozoneDu: ozoneDU(city.lat, city.lon, doy15),
    elevationM: city.elevation ?? 0,
  });

  /**
   * `dailySunTimes` reports polar day and polar night the same way — a null
   * sunrise and sunset, with `polar` naming which one it is. There is no
   * sentinel hour to filter out. One such day in the month is enough: the
   * paragraph's job is to warn that the month has no single sunrise time, and
   * a month that turns polar halfway through has exactly that problem.
   */
  const polar = days.some((d) => d.polar !== null);
  const hasWindow = exposure !== null && exposure.windowEnd > exposure.windowStart;

  const firstLen = dayLengthMin(first);
  const lastLen = dayLengthMin(last);

  return {
    regime: polar ? "polar" : hasWindow ? "synthesis" : "none",
    lat: city.lat,
    days: days.length,
    firstSunrise: first.sunrise,
    firstSunset: first.sunset,
    lastSunrise: last.sunrise,
    lastSunset: last.sunset,
    midDayLengthMin: dayLengthMin(mid),
    dayLengthDeltaMin: firstLen !== null && lastLen !== null ? Math.round(lastLen - firstLen) : 0,
    peakElevationDeg: Math.max(...curve.map((p) => p.elevation)),
    vitD: hasWindow
      ? {
          windowStart: exposure!.windowStart,
          windowEnd: exposure!.windowEnd,
          minutesNeeded: Math.round(exposure!.minutesNeeded),
          bestUVI: Number(exposure!.bestUVI.toFixed(1)),
        }
      : null,
  };
}
