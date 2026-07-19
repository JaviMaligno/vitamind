import { declination, equationOfTime, dayOfYear } from "./solar";
import { tzOffsetForDate } from "./timezone";

const RAD = Math.PI / 180;

/** Standard sunrise/sunset altitude: refraction (~0.57°) + solar semidiameter. */
const HORIZON_DEG = -0.833;
/** Upper bound of the golden hour: sun below ~6° gives the warm, low light. */
const GOLDEN_DEG = 6;
/** Civil twilight bound: sun ≤6° below the horizon still gives usable light. */
const CIVIL_DEG = -6;

export interface SunTimes {
  /** Local hours (0–24). `null` on polar day/night. */
  sunrise: number | null;
  sunset: number | null;
  solarNoon: number;
  /** Civil dawn/dusk (sun crosses 6° below the horizon); `null` when it never does. */
  civilDawn: number | null;
  civilDusk: number | null;
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
  const civil = halfDayAt(lat, doy, CIVIL_DEG);
  const civilHalf = typeof civil === "number" ? civil : null;

  const dayLengthMin = dayLengthMinutes(lat, doy);
  const yesterdayDoy = doy > 1 ? doy - 1 : 365;
  const dayLengthDeltaMin = dayLengthMin - dayLengthMinutes(lat, yesterdayDoy);

  if (typeof half !== "number") {
    return {
      sunrise: null,
      sunset: null,
      solarNoon,
      // Polar night can still have civil twilight around noon.
      civilDawn: half === "below" && civilHalf !== null ? wrap24(solarNoon - civilHalf) : null,
      civilDusk: half === "below" && civilHalf !== null ? wrap24(solarNoon + civilHalf) : null,
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
    civilDawn: civilHalf !== null ? wrap24(solarNoon - civilHalf) : null,
    civilDusk: civilHalf !== null ? wrap24(solarNoon + civilHalf) : null,
    goldenMorningEnd: goldenHalf !== null ? wrap24(solarNoon - goldenHalf) : null,
    goldenEveningStart: goldenHalf !== null ? wrap24(solarNoon + goldenHalf) : null,
    dayLengthMin,
    dayLengthDeltaMin,
    polar: null,
  };
}

export interface MonthlySunTimes {
  /** 0-based month index (0 = January). */
  monthIndex: number;
  /** Local hours (0–24). `null` on polar day/night. */
  sunrise: number | null;
  sunset: number | null;
  /** Minutes of daylight (0 on polar night, 1440 on polar day). */
  dayLengthMin: number;
  polar: "day" | "night" | null;
}

/**
 * Sun times for the 15th of each month — stable, build-time-safe values for the
 * static city pages (same fixed reference year the city copy helpers use).
 */
export function monthlySunTimes(lat: number, lon: number, timezone?: string, tzFallback = 0): MonthlySunTimes[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const st = getSunTimes(lat, lon, new Date(2026, monthIndex, 15), timezone, tzFallback);
    return {
      monthIndex,
      sunrise: st.sunrise,
      sunset: st.sunset,
      dayLengthMin: st.dayLengthMin,
      polar: st.polar,
    };
  });
}

export interface DailySunTimes {
  /** Day of month, 1-based. */
  day: number;
  civilDawn: number | null;
  sunrise: number | null;
  sunset: number | null;
  civilDusk: number | null;
  polar: "day" | "night" | null;
}

/**
 * Day-by-day times for one month of the fixed reference year — the data behind
 * the expandable rows of the monthly table. Same model as everything else, so
 * it stays consistent with the summary values.
 */
export function dailySunTimes(lat: number, lon: number, monthIndex: number, timezone?: string, tzFallback = 0): DailySunTimes[] {
  const days = new Date(2026, monthIndex + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const st = getSunTimes(lat, lon, new Date(2026, monthIndex, i + 1), timezone, tzFallback);
    return {
      day: i + 1,
      civilDawn: st.civilDawn,
      sunrise: st.sunrise,
      sunset: st.sunset,
      civilDusk: st.civilDusk,
      polar: st.polar,
    };
  });
}
