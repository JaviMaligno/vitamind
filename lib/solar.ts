import type { SolarPoint, VitDWindow } from "./types";
import { tzOffsetForDate } from "./timezone";

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

export function solarElev(lat: number, lon: number, doy: number, utcH: number): number {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const ha = ((utcH - (12 - lon / 15 - equationOfTime(doy) / 60)) * 15) * RAD;
  const sinElev = Math.sin(lr) * Math.sin(d) + Math.cos(lr) * Math.cos(d) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;
}

export function getCurve(lat: number, lon: number, doy: number, tz: number, timezone?: string): SolarPoint[] {
  const effectiveTz = timezone
    ? tzOffsetForDate(timezone, dateFromDoy(doy))
    : tz;

  const p: SolarPoint[] = [];
  for (let m = 0; m <= 1440; m += 5) {
    const localH = m / 60;
    const utcH = localH - effectiveTz;
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

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Reads in UTC, to match how `dateFromDoy` builds its dates. */
export function fmtDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}
