import { declination, equationOfTime, dayOfYear, daysInMonth, DOY_REFERENCE_YEAR, HORIZON_DEG } from "./solar";
import { tzOffsetForDate } from "./timezone";

const RAD = Math.PI / 180;

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
 * One event, from hours-after-UTC-midnight to the clock time the city shows.
 *
 * THE OFFSET IS READ AT THE EVENT'S OWN INSTANT. It used to be read once per
 * day, at whatever instant the caller's `date` happened to be — UTC midnight of
 * that day for every caller on this site. On a day when the zone changes offset
 * (two a year wherever DST is observed) the instant that starts the day and the
 * instant the sun rises sit on opposite sides of the transition, so every
 * printed time on that day came out an hour wrong: America/Chicago is at -05:00
 * at 00:00 UTC on 1 November 2026, moves to -06:00 at 07:00 UTC (02:00 local),
 * and the sun rises later still, at 12:26 UTC — so the page shipped 07:26 for a
 * sunrise the zone calls 06:26.
 *
 * Each event gets its own probe rather than one probe per day, because that is
 * what the identity `printed == Intl.format(instant, zone)` says: nothing ties
 * a dawn and a dusk to the same offset except the usual accident that
 * transitions happen at night.
 */
function localHoursOf(
  utcMidnight: number, utcHours: number, timezone: string | undefined, tzFallback: number,
): number {
  const offset = timezone
    ? tzOffsetForDate(timezone, new Date(utcMidnight + utcHours * 3_600_000))
    : tzFallback;
  return wrap24(utcHours + offset);
}

/**
 * Today's sun times for a location, in local hours. Uses the same solar model as
 * `solarElev` (declination + equation of time), so times land within a few
 * minutes of ephemeris values — plenty for an at-a-glance panel.
 *
 * `date` is read in UTC, like everything that goes through `dayOfYear`.
 */
export function getSunTimes(lat: number, lon: number, date: Date, timezone?: string, tzFallback = 0): SunTimes {
  const doy = dayOfYear(date);
  // The astronomy first, with no zone in it: hours from UTC midnight of this
  // day. A sunrise is an absolute instant, and the timezone decides only how
  // that instant is printed — so the offset cannot be folded in here.
  const solarNoonUtc = 12 - lon / 15 - equationOfTime(doy) / 60;
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const local = (utcHours: number) => localHoursOf(utcMidnight, utcHours, timezone, tzFallback);
  const solarNoon = local(solarNoonUtc);

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
      civilDawn: half === "below" && civilHalf !== null ? local(solarNoonUtc - civilHalf) : null,
      civilDusk: half === "below" && civilHalf !== null ? local(solarNoonUtc + civilHalf) : null,
      goldenMorningEnd: null,
      goldenEveningStart: null,
      dayLengthMin,
      dayLengthDeltaMin,
      polar: half === "above" ? "day" : "night",
    };
  }

  return {
    sunrise: local(solarNoonUtc - half),
    sunset: local(solarNoonUtc + half),
    solarNoon,
    civilDawn: civilHalf !== null ? local(solarNoonUtc - civilHalf) : null,
    civilDusk: civilHalf !== null ? local(solarNoonUtc + civilHalf) : null,
    goldenMorningEnd: goldenHalf !== null ? local(solarNoonUtc - goldenHalf) : null,
    goldenEveningStart: goldenHalf !== null ? local(solarNoonUtc + goldenHalf) : null,
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
 *
 * "Build-time-safe" is what `Date.UTC` buys. The host-local constructor made
 * these tables a function of the builder's own timezone: `new Date(2026, 7, 15)`
 * is 14 August 23:00 UTC in the Canaries and 15 August 10:00 UTC in Honolulu,
 * and `dayOfYear` reads it in UTC either way, so the day number itself moved. A
 * laptop in Atlantic/Canary emitted 07:11 for a Madrid August day where Vercel
 * emitted 07:12; production was right only by the accident of Vercel's builders
 * running in UTC.
 */
export function monthlySunTimes(lat: number, lon: number, timezone?: string, tzFallback = 0): MonthlySunTimes[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const st = getSunTimes(lat, lon, new Date(Date.UTC(DOY_REFERENCE_YEAR, monthIndex, 15)), timezone, tzFallback);
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
 *
 * UTC throughout, for the reason given on `monthlySunTimes`.
 *
 * The row count is `daysInMonth`, not the older `new Date(y, m + 1, 0).getDate()`.
 * That older form was NOT a bug: a host-local constructor read back with a
 * host-local getter cancels, and it returns the same twelve counts under every
 * host zone (measured: UTC, Atlantic/Canary, Pacific/Honolulu, Australia/Sydney).
 * It is replaced because it expressed a calendar fact through a wall-clock
 * round-trip, not because it ever produced a wrong number.
 */
export function dailySunTimes(lat: number, lon: number, monthIndex: number, timezone?: string, tzFallback = 0): DailySunTimes[] {
  const days = daysInMonth(monthIndex);
  return Array.from({ length: days }, (_, i) => {
    const st = getSunTimes(lat, lon, new Date(Date.UTC(DOY_REFERENCE_YEAR, monthIndex, i + 1)), timezone, tzFallback);
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
