/**
 * The ozone climatology the app reads, and how to read it at an arbitrary
 * latitude and day.
 *
 * Deliberately free of any dependency on `lib/uv-model.ts`: that module reads
 * THIS one, and the fitting code in `lib/ozone-fit.ts` reads both. Keeping the
 * table and its lookup here is what stops that from being a cycle.
 *
 * `OZONE_TABLE` SHIPS EMPTY, WHICH IS NOT AN OVERSIGHT. An empty table makes
 * `lookupOzone` fall back to its `fallback` argument for every cell, and every
 * caller passes van Heuklon (1979) — so today this changes nothing at all. The
 * seam exists so that adopting a real climatology is pasting one generated file
 * and re-running the suite, rather than a refactor. See docs/ozone-rebase.md
 * for how the table is produced and what must be checked before it is adopted.
 */

/**
 * A zonal-mean table: `values[band][month]` in Dobson Units, with `bandDeg`-wide
 * latitude bands running south to north from -90.
 *
 * Zonal because that is what the underlying field mostly is — total column ozone
 * varies far more with latitude and season than with longitude, and van Heuklon
 * itself carries only a small longitude term. Dropping longitude keeps the table
 * to a couple of hundred numbers that can be read and checked by a person.
 */
export interface OzoneTable {
  bandDeg: number;
  /** `values[band][month]`, band 0 starting at -90, month 0 = January. */
  values: (number | null)[][];
}

/** Which band a latitude falls in, and the band's centre. */
export function bandIndex(lat: number, bandDeg: number): number {
  const i = Math.floor((lat + 90) / bandDeg);
  return Math.min(Math.max(i, 0), Math.ceil(180 / bandDeg) - 1);
}

export function bandCentre(index: number, bandDeg: number): number {
  return -90 + (index + 0.5) * bandDeg;
}

/** Month index 0-11 for a day of the reference year. Cheap and leap-free. */
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export function monthOfDoy(doy: number): number {
  const d = Math.min(Math.max(Math.round(doy), 1), 365);
  for (let m = 11; m >= 0; m--) if (d > MONTH_STARTS[m]) return m;
  return 0;
}

/** The middle day of a month, as a day of year — where its value is anchored. */
export function monthMidDoy(month: number): number {
  const m = ((month % 12) + 12) % 12;
  const start = MONTH_STARTS[m];
  const end = m === 11 ? 365 : MONTH_STARTS[m + 1];
  return Math.round((start + end) / 2) + (start === end ? 0 : 0);
}

/** Linear interpolation between two values, `t` in 0..1. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Read the table at an arbitrary latitude and day, smoothly.
 *
 * Bilinear in (latitude, day of year): between band centres and between
 * mid-month anchors, with the year wrapping December to January so 31 December
 * and 1 January do not sit on a step. A step there would be visible — adjacent
 * days on 3,318 pages would report windows minutes apart for no physical reason.
 *
 * Missing cells fall back to the nearest month in the same band that has a
 * value, and then to `fallback` (the caller passes van Heuklon) if the whole
 * band is empty. So a partial table degrades to the old behaviour band by band
 * instead of failing or inventing.
 */
export function lookupOzone(
  table: OzoneTable,
  lat: number,
  doy: number,
  fallback: (lat: number, doy: number) => number,
): number {
  const bands = table.values.length;
  const exact = (bandDeg: number, i: number, m: number): number | null => {
    if (i < 0 || i >= bands) return null;
    const row = table.values[i];
    if (row[m] !== null) return row[m];
    // Nearest month in the same band, searching outward, wrapping the year.
    for (let d = 1; d <= 6; d++) {
      const a = row[(m - d + 12) % 12];
      if (a !== null) return a;
      const b = row[(m + d) % 12];
      if (b !== null) return b;
    }
    return null;
  };

  // Latitude: between the two nearest band centres.
  const raw = (lat + 90) / table.bandDeg - 0.5;
  const i0 = Math.floor(raw);
  const tLat = raw - i0;
  // Day of year: between the two mid-month anchors that bracket it, going round
  // the year. Written as a search over the twelve anchors rather than as
  // arithmetic on the month index, because the arithmetic version got the
  // before-the-anchor case wrong and put a 3.5 DU step on 15 January — one day
  // reading differently from the next for no physical reason, which is exactly
  // what this interpolation exists to prevent.
  const { mA, mB, tDay } = bracketMonths(doy);

  const corners = [
    [exact(table.bandDeg, i0, mA), exact(table.bandDeg, i0, mB)],
    [exact(table.bandDeg, i0 + 1, mA), exact(table.bandDeg, i0 + 1, mB)],
  ];
  if (corners.some((row) => row.some((v) => v === null))) return fallback(lat, doy);

  const lower = lerp(corners[0][0]!, corners[0][1]!, tDay);
  const upper = lerp(corners[1][0]!, corners[1][1]!, tDay);
  return lerp(lower, upper, Math.min(Math.max(tLat, 0), 1));
}

/** Distance from `from` to `to` around a 365-day circle, always positive. */
function cyclicGap(from: number, to: number): number {
  const d = to - from;
  return d > 0 ? d : d + 365;
}

/**
 * The two mid-month anchors `doy` sits between, and how far along it is.
 *
 * Every day of the year is between exactly one adjacent pair once the year is
 * treated as a circle, so this finds that pair by walking the twelve anchors.
 */
function bracketMonths(doy: number): { mA: number; mB: number; tDay: number } {
  const d = Math.min(Math.max(Math.round(doy), 1), 365);
  for (let m = 0; m < 12; m++) {
    const a = monthMidDoy(m);
    const b = monthMidDoy((m + 1) % 12);
    const span = cyclicGap(a, b);
    const along = cyclicGap(a, d);
    // `cyclicGap` never returns 0, so a day sitting exactly on anchor `a` comes
    // back as a full lap; that is the previous pair's endpoint, handled below.
    if (along < span) return { mA: m, mB: (m + 1) % 12, tDay: along / span };
  }
  // `d` is exactly on an anchor: return that anchor's own value.
  const m = monthOfDoy(d);
  return { mA: m, mB: m, tDay: 0 };
}

/**
 * The table in force. Empty until a sampling run produces one — see the module
 * comment above, and docs/ozone-rebase.md for the procedure.
 */
export const OZONE_TABLE: OzoneTable = { bandDeg: 10, values: [] };
