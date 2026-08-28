import type { SolarPoint, VitDWindow } from "./types";
import { zoneOffsetAtLocalHour } from "./timezone";
import { shortMonthName } from "./city-copy";

const RAD = Math.PI / 180;

export function declination(doy: number): number {
  return 23.44 * Math.sin(((360 / 365) * (doy - 81)) * RAD);
}

export function vitDHrs(lat: number, doy: number, thr: number): number {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const tr = thr * RAD;
  const cd = Math.cos(lr) * Math.cos(d);
  if (Math.abs(cd) < 1e-10) return 0;
  const cosH = (Math.sin(tr) - Math.sin(lr) * Math.sin(d)) / cd;
  if (cosH >= 1) return 0;
  if (cosH <= -1) return 24;
  return (2 * Math.acos(cosH) * 12) / Math.PI;
}

/** Equation of time in minutes: how far solar noon drifts from clock noon. */
export function equationOfTime(doy: number): number {
  const B = ((360 / 365) * (doy - 81)) * RAD;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * The altitude the sun's centre has when this site calls it risen or set:
 * refraction at the horizon (~0.57°) plus the solar semidiameter (~0.27°), so
 * the upper limb appears to touch a flat horizon while the centre is still
 * below it.
 *
 * It lives here, next to the geometry, because two things now depend on it and
 * they must not drift apart: `getSunTimes` decides WHEN the sun rises, and
 * `sunDirection` decides WHERE. Copy that prints both in one sentence is
 * describing a single instant, and a second copy of this number is how that
 * stops being true.
 */
export const HORIZON_DEG = -0.833;

/**
 * Where on the compass the sun comes up and goes down, in degrees clockwise
 * from true north (0 = N, 90 = E, 180 = S, 270 = W).
 *
 * Latitude and day only — no longitude, and no timezone. Longitude moves the
 * clock time of a sunrise, not its bearing; the bearing is fixed by the
 * declination and the observer's latitude alone. Feeding a longitude in would
 * imply an accuracy the model does not have.
 */
export interface SunDirection {
  sunriseBearing: number;
  sunsetBearing: number;
}

/**
 * The bearing of sunrise and sunset for a latitude and day of year, or `null`
 * on a day the sun never crosses that altitude.
 *
 * ROUTE: solve the horizon crossing for the hour angle, then read the bearing
 * off the sun's horizon-frame vector with `atan2`. The alternative — inverting
 * `sin d = sin h sin lat + cos h cos lat cos A` with `acos` — needs a separate
 * rule to decide which of the two crossings it just found, and loses precision
 * exactly where the answer matters most, at the high latitudes where the
 * bearing swings toward due north. `atan2` gets the quadrant from the signs.
 *
 * WHY THE POLAR TEST IS THE HOUR ANGLE'S AND NOT THE BEARING'S: the two are
 * mathematically equivalent (both say the pole/zenith/sun triangle closes), but
 * `halfDayAt` in `lib/sun-times.ts` draws the line with this expression, and a
 * page that printed a sunrise time with no direction beside it — or a direction
 * on a day with no sunrise — would be a visible contradiction. Sharing the
 * test makes that agreement structural rather than a coincidence of rounding;
 * `sun-azimuth.test.ts` sweeps every degree of latitude to hold it.
 *
 * `elevDeg` defaults to the same refracted horizon `getSunTimes` uses, so the
 * bearing belongs to the instant the tables print. It is a parameter because
 * the geometric horizon (0) is where the equinox identity — due east at every
 * latitude — is exact, and that is the strongest check this maths has.
 *
 * ACCURACY: `declination` is the one-term approximation, one value per day,
 * which puts the model's equinox on day 81 against a true equinox on 20 March
 * and leaves declination off by up to ~1°. That is ~1-2° of bearing (more the
 * further from the equator, since cos(lat) divides it), and it also means
 * sunrise and sunset here are exact mirrors when the real pair differ by a few
 * tenths of a degree. Fine for naming a compass sector; not for aiming
 * anything.
 */
export function sunDirection(lat: number, doy: number, elevDeg: number = HORIZON_DEG): SunDirection | null {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const hr = elevDeg * RAD;

  const cd = Math.cos(lr) * Math.cos(d);
  // At the poles cos(lat) collapses and the hour angle stops meaning anything —
  // every direction is south, or north. Same guard, same constant as `halfDayAt`.
  if (Math.abs(cd) < 1e-10) return null;
  const cosH = (Math.sin(hr) - Math.sin(lr) * Math.sin(d)) / cd;
  if (cosH <= -1 || cosH >= 1) return null;

  // Hour angle of the crossing, negative in the morning by the usual convention.
  const H = -Math.acos(cosH);
  const east = -Math.cos(d) * Math.sin(H);
  const north = Math.sin(d) * Math.cos(lr) - Math.cos(d) * Math.sin(lr) * Math.cos(H);
  // `cosH` is strictly inside (-1, 1) by the check above, so H is strictly
  // negative, `east` strictly positive, and `atan2` lands in (0, 180) — the
  // eastern half, where a sunrise belongs. No wrap is needed and none is added:
  // one that could never fire would imply a case that does not exist. The range
  // is asserted over a full latitude sweep in `sun-azimuth.test.ts` instead.
  const sunriseBearing = Math.atan2(east, north) / RAD;

  // Sunset is the same crossing with the hour angle's sign flipped: `north` is
  // even in H and `east` is odd, so the bearing mirrors about the north-south
  // axis. Exact only because this model holds declination fixed across the day.
  return { sunriseBearing, sunsetBearing: 360 - sunriseBearing };
}

export function solarElev(lat: number, lon: number, doy: number, utcH: number): number {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const ha = ((utcH - (12 - lon / 15 - equationOfTime(doy) / 60)) * 15) * RAD;
  const sinElev = Math.sin(lr) * Math.sin(d) + Math.cos(lr) * Math.cos(d) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;
}

/**
 * The sun's elevation through one local day, sampled every five minutes and
 * indexed by the city's WALL CLOCK — what its consumers ask for ("what is the
 * sun doing here at 13:00"), and the inverse of the conversion `getSunTimes`
 * does. `computeExposureFromCurve` reads one sample per integer hour, so these
 * labels become the vitamin D window the city hub is about.
 *
 * THE OFFSET IS READ PER SAMPLE, not once per curve. It used to be read once at
 * `dateFromDoy(doy)` — UTC midnight — which is the same bug `lib/sun-times.ts`
 * carried: on a day whose zone changes offset, midnight and midday sit on
 * opposite sides of the transition, so every hour of the day was labelled with
 * an offset the zone had already left. Far enough from Greenwich the probe was
 * not even in the same local day: Santiago's two wrong days were 5 April and
 * 6 September, the day AFTER each transition, whose local hours all share one
 * offset while UTC midnight still falls in the previous day. Sydney, east of
 * Greenwich, had the mirror of that luck and was never wrong.
 *
 * Madrid's window on 25 October 2026 came out 13:00–16:00 where the city's
 * clock says 12:00–15:00, printed beside a sunrise `getSunTimes` had already
 * placed correctly — a page disagreeing with itself. Across the 40 hub cities,
 * 35 city-days a year were affected, every one by exactly an hour: the old
 * window ran an hour early on 23 of them (spring forward) and an hour late on
 * 12 (autumn back). The sunrise/sunset tables come from `getSunTimes` and are
 * untouched by this.
 *
 * Per sample rather than per curve is what the wall-clock index MEANS: hours on
 * the two sides of a transition are placed by different offsets, and nothing
 * ties them together except the accident that transitions happen at night. In
 * this city list that accident does hold — every one of the 35 changed days
 * moved as a block, window start and end together, which is what a single
 * post-transition offset across all the daylight hours looks like — but a curve
 * indexed by wall clock has no business relying on it.
 */
export function getCurve(lat: number, lon: number, doy: number, tz: number, timezone?: string): SolarPoint[] {
  const utcMidnight = dateFromDoy(doy).getTime();
  const offsetAt = (localH: number) =>
    timezone ? zoneOffsetAtLocalHour(timezone, utcMidnight, localH) : tz;
  // Two probes settle the whole day, since no zone in the tzdata for the
  // reference year changes offset twice within one day: a day that starts and
  // ends on the same offset never left it, and then one number serves every
  // sample. So an ordinary day costs four `Intl` reads rather than the 578 a
  // naive per-sample loop would take, and only the two transition days a year
  // pay the full price.
  const dayStart = offsetAt(0);
  const constant = dayStart === offsetAt(24) ? dayStart : null;

  const p: SolarPoint[] = [];
  for (let m = 0; m <= 1440; m += 5) {
    const localH = m / 60;
    const utcH = localH - (constant ?? offsetAt(localH));
    p.push({ localHours: localH, elevation: solarElev(lat, lon, doy, utcH) });
  }
  return p;
}

export function getWindow(curve: SolarPoint[], threshold: number): VitDWindow | null {
  const above = curve.filter((p) => p.elevation >= threshold);
  if (!above.length) return null;
  return {
    start: above[0].localHours,
    end: above[above.length - 1].localHours,
    peak: Math.max(...curve.map((p) => p.elevation)),
  };
}

/**
 * The year every table on this site is computed for.
 *
 * Exported so copy can state it instead of guessing. A passage that says "this
 * year" beside figures pinned here becomes false on 1 January, and wrong about
 * February in a leap year.
 */
export const DOY_REFERENCE_YEAR = 2026;

/**
 * The day-of-year calendar is a pure UTC convention, and every function here
 * builds and reads its dates in UTC on purpose.
 *
 * It used to use the local-time constructor and local getters, which looks
 * self-consistent and is not: the offset in January differs from the offset in
 * July in every DST zone, so `dayOfYear(new Date(2026, 6, 1))` returned 182 in
 * UTC and 181 in Madrid or New York. That day of drift moved season edges and
 * month boundaries, which meant the deployed server (Vercel runs UTC) answered
 * differently from any developer's laptop — issue #25.
 *
 * Consequence for callers: a Date handed to `dayOfYear` is interpreted in UTC.
 * For "what day is it where the USER is", normalise their local calendar date
 * first — that is what `todayDoy()` is for.
 */
export function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
}

export function dateFromDoy(doy: number): Date {
  return new Date(Date.UTC(DOY_REFERENCE_YEAR, 0, doy));
}

/** Day number for a calendar month/day, without going through a local Date. */
export function doyFromMonthDay(monthIndex: number, day: number): number {
  return dayOfYear(new Date(Date.UTC(DOY_REFERENCE_YEAR, monthIndex, day)));
}

/** Days in a month of the reference year. */
export function daysInMonth(monthIndex: number): number {
  return new Date(Date.UTC(DOY_REFERENCE_YEAR, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The day number of the viewer's own calendar day. Used by the client, where
 * "today" means today where the user is standing, not today in UTC — without
 * this, anyone west of Greenwich would jump a day during their evening.
 */
export function todayDoy(now: Date = new Date()): number {
  return dayOfYear(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function fmtTime(h: number): string {
  let hr = Math.floor(h);
  let mn = Math.round((h - hr) * 60);
  // Rounding 59.7 gives 60, which is not a minute of any hour: carry it.
  if (mn === 60) {
    mn = 0;
    hr = (hr + 1) % 24;
  }
  return `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

/**
 * Minutes of daylight between a local sunrise and sunset, in minutes.
 *
 * Both come back wrapped into 0–24, so above roughly 63° in midsummer a sunset
 * after local midnight is a *smaller* number than the sunrise. Subtracting
 * naively then gives a negative day length, which is what
 * `/amanecer/reikiavik/junio` rendered on 13 of its 30 rows — a table saying the
 * day lasted minus three hours. The modulo is the whole fix.
 *
 * Returns null when either end is missing, which is how a polar day arrives.
 */
export function dayLengthMinutes(sunrise: number | null, sunset: number | null): number | null {
  if (sunrise === null || sunset === null) return null;
  return (((sunset - sunrise) % 24) + 24) % 24 * 60;
}

/** "13 h 46 min" from a duration in minutes, carrying a rounded 60 into the hour. */
export function fmtDayLength(min: number): string {
  let h = Math.floor(min / 60);
  let m = Math.round(min - h * 60);
  if (m === 60) {
    m = 0;
    h += 1;
  }
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/**
 * "27 ago" / "27 Aug" — day and abbreviated month in the caller's locale.
 *
 * Reads in UTC, to match how `dateFromDoy` builds its dates.
 *
 * `locale` is required rather than defaulting to `"es"`, because a default is
 * how this function shipped Spanish month names to all six locales in the first
 * place: the two call sites both have the locale to hand, and a required
 * parameter makes `tsc` the thing that finds a third one.
 *
 * The month is formatted alone and composed by hand, rather than asking `Intl`
 * for `{ day, month }` together. That is the shape PR #61 used for the heatmap's
 * month axis in `GlobalHeatmap.tsx`, and it keeps one string shape across the
 * six locales — `Intl`'s combined pattern would give "Aug 27" in English and
 * "08-27" in Lithuanian, and the heatmap tooltip it feeds is a fixed 144px box.
 * The trailing `.` some locales append (ru "авг.") is stripped for the same
 * reason it is stripped there.
 *
 * The month comes from `shortMonthName` in lib/city-copy.ts rather than from
 * `Intl` here, because `Intl`'s `{ month: "short" }` returns "08" in Lithuanian
 * and this repo settled that case already — see the comment on LT_MONTH_LABELS.
 * The UTC reading the header promises is preserved by passing `getUTCMonth()`:
 * the helper takes an index, so no timezone can enter through it.
 */
export function fmtDate(d: Date, locale: string): string {
  return `${d.getUTCDate()} ${shortMonthName(locale, d.getUTCMonth())}`;
}
