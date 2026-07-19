import { declination, equationOfTime, dayOfYear } from "./solar";
import { tzOffsetForDate } from "./timezone";

const RAD = Math.PI / 180;

/** Standard sunrise/sunset altitude: refraction (~0.57°) + solar semidiameter. */
const HORIZON_DEG = -0.833;
/** Upper bound of the golden hour: sun below ~6° gives the warm, low light. */
const GOLDEN_DEG = 6;

export interface SunTimes {
  /** Local hours (0–24). `null` on polar day/night. */
  sunrise: number | null;
  sunset: number | null;
  solarNoon: number;
  /** Morning golden hour runs sunrise → this; `null` when the sun never reaches 6°. */
  goldenMorningEnd: number | null;
  /** Evening golden hour runs this → sunset; `null` when the sun never reaches 6°. */
  goldenEveningStart: number | null;
  /** Minutes of daylight (0 on polar night, 1440 on polar day). */
  dayLengthMin: number;
  /** Day length change vs yesterday, in minutes (positive = days getting longer). */
  dayLengthDeltaMin: number;
  polar: "day" | "night" | null;
}

/**
 * Half-day hour angle: hours between solar noon and the sun crossing `elevDeg`.
 * "above"/"below" flag days where the sun never crosses that altitude at all.
 */
function halfDayAt(lat: number, doy: number, elevDeg: number): number | "above" | "below" {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const cd = Math.cos(lr) * Math.cos(d);
  if (Math.abs(cd) < 1e-10) return "below";
  const cosH = (Math.sin(elevDeg * RAD) - Math.sin(lr) * Math.sin(d)) / cd;
  if (cosH <= -1) return "above";
  if (cosH >= 1) return "below";
  return (Math.acos(cosH) * 12) / Math.PI;
}

function dayLengthMinutes(lat: number, doy: number): number {
  const h = halfDayAt(lat, doy, HORIZON_DEG);
  if (h === "above") return 1440;
  if (h === "below") return 0;
  return 2 * h * 60;
}

const wrap24 = (h: number) => ((h % 24) + 24) % 24;

/**
 * Today's sun times for a location, in local hours. Uses the same solar model as
 * `solarElev` (declination + equation of time), so times land within a few
 * minutes of ephemeris values — plenty for an at-a-glance panel.
 */
export function getSunTimes(lat: number, lon: number, date: Date, timezone?: string, tzFallback = 0): SunTimes {
  const doy = dayOfYear(date);
  const offset = timezone ? tzOffsetForDate(timezone, date) : tzFallback;
  const solarNoon = wrap24(12 - lon / 15 - equationOfTime(doy) / 60 + offset);

  const half = halfDayAt(lat, doy, HORIZON_DEG);
  const golden = halfDayAt(lat, doy, GOLDEN_DEG);
  const goldenHalf = typeof golden === "number" ? golden : null;

  const dayLengthMin = dayLengthMinutes(lat, doy);
  const yesterdayDoy = doy > 1 ? doy - 1 : 365;
  const dayLengthDeltaMin = dayLengthMin - dayLengthMinutes(lat, yesterdayDoy);

  if (typeof half !== "number") {
    return {
      sunrise: null,
      sunset: null,
      solarNoon,
      goldenMorningEnd: null,
      goldenEveningStart: null,
      dayLengthMin,
      dayLengthDeltaMin,
      polar: half === "above" ? "day" : "night",
    };
  }

  return {
    sunrise: wrap24(solarNoon - half),
    sunset: wrap24(solarNoon + half),
    solarNoon,
    goldenMorningEnd: goldenHalf !== null ? wrap24(solarNoon - goldenHalf) : null,
    goldenEveningStart: goldenHalf !== null ? wrap24(solarNoon + goldenHalf) : null,
    dayLengthMin,
    dayLengthDeltaMin,
    polar: null,
  };
}
