/**
 * Deriving a total-column ozone climatology from clear-sky UV observations.
 *
 * WHY THIS EXISTS. `ozoneDU` in `lib/uv-model.ts` is van Heuklon (1979), a
 * closed-form fit to pre-1979 data. It has no day-to-day term and, measured
 * against Open-Meteo on 2026-09-22, it is wrong in BOTH directions: about 69 DU
 * high over London and 173 DU low over Nairobi (docs/uv-sources.md). The error
 * changes sign with latitude, so no constant repairs it — the fit's amplitude
 * across latitude is wrong, not its offset.
 *
 * WHAT THIS PRODUCES IS A CALIBRATION, NOT A MEASUREMENT, and the distinction
 * is the whole reason it is safe to build this way. `impliedOzone` inverts OUR
 * `uvIndex` for the column that would make it reproduce somebody else's
 * clear-sky UV at the same sun angle. If their radiative transfer differs from
 * Madronich's in any systematic way, that difference lands in this number and is
 * NOT the real ozone column over that city. It is the ozone-shaped parameter
 * that makes our formula agree with theirs — which is exactly what the static
 * pages need, because agreement is the goal and the parameter is unobservable
 * to a reader either way.
 *
 * Anyone tempted to present the output as an ozone dataset should not. It is a
 * fitted coefficient with a physical name.
 *
 * The network half lives in `scripts/ozone-sample.ts`; everything here is pure
 * so it can be tested without it. See `docs/ozone-rebase.md` for the runbook.
 */

import { uvIndex } from "./uv-model";
import { bandIndex, monthOfDoy, type OzoneTable } from "./ozone-table";

/** One clear-sky observation, already reduced to what the fit needs. */
export interface OzoneSample {
  /** Degrees north, -90..90. */
  lat: number;
  /** 1-365 in the site's reference year. */
  doy: number;
  /** Solar elevation at the moment of the reading, degrees above the horizon. */
  elevationDeg: number;
  /** Observer altitude, metres. */
  elevationM: number;
  /** The provider's CLEAR-SKY UV index for that moment. */
  uviClearSky: number;
}

/**
 * The ozone column that makes `uvIndex` reproduce `targetUVI` at this sun angle
 * and altitude. Bisection over a generous bracket, fixed iteration count so it
 * cannot loop on float equality.
 *
 * Returns null where the question is meaningless: the sun too low for the model
 * to be informative, or a target no column in the bracket can produce (monotone
 * in ozone, so an unreachable target means the reading and the geometry
 * disagree — a mislabelled hour, most likely).
 */
export function impliedOzone(
  targetUVI: number,
  elevationDeg: number,
  elevationM: number,
  bracket: [number, number] = [100, 600],
): number | null {
  if (!(targetUVI > 0) || elevationDeg < MIN_USEFUL_ELEVATION_DEG) return null;
  const [lo0, hi0] = bracket;
  // uvIndex falls as ozone rises, so the bracket is inverted.
  if (uvIndex(elevationDeg, lo0, elevationM) < targetUVI) return null;
  if (uvIndex(elevationDeg, hi0, elevationM) > targetUVI) return null;
  let lo = lo0;
  let hi = hi0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (uvIndex(elevationDeg, mid, elevationM) > targetUVI) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Below this the inversion is not worth doing. Madronich's formula is stated
 * valid for solar zenith angles 0-60 degrees, i.e. elevation 30 and above; at
 * lower sun it is an extrapolation and the ozone recovered from it would be
 * fitting the extrapolation's error rather than the column. `uv-model.ts` says
 * the same thing about where it may and may not be trusted.
 */
export const MIN_USEFUL_ELEVATION_DEG = 30;

/** Median, so one mislabelled cloudy hour cannot drag a cell. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface FitOptions {
  bandDeg?: number;
  /** A cell with fewer samples than this stays null rather than guessing. */
  minSamples?: number;
}

/**
 * Reduce samples to one value per (latitude band, month).
 *
 * Cells with too little support are left NULL on purpose. A table that silently
 * interpolates across a hole is a table nobody can audit; `lookupOzone` fills
 * holes at read time, visibly, and `tableCoverage` reports them so the runbook
 * can require a threshold before the table is adopted.
 */
export function fitOzoneTable(samples: OzoneSample[], opts: FitOptions = {}): OzoneTable {
  const bandDeg = opts.bandDeg ?? 10;
  const minSamples = opts.minSamples ?? 3;
  const bands = Math.ceil(180 / bandDeg);
  const buckets: number[][][] = Array.from({ length: bands }, () =>
    Array.from({ length: 12 }, () => [] as number[]),
  );

  for (const s of samples) {
    const du = impliedOzone(s.uviClearSky, s.elevationDeg, s.elevationM);
    if (du === null) continue;
    buckets[bandIndex(s.lat, bandDeg)][monthOfDoy(s.doy)].push(du);
  }

  return {
    bandDeg,
    values: buckets.map((months) =>
      months.map((xs) => (xs.length >= minSamples ? Math.round(median(xs) * 10) / 10 : null)),
    ),
  };
}

/** Filled cells over total cells, and which bands are empty for every month. */
export function tableCoverage(table: OzoneTable): { filled: number; total: number; emptyBands: number[] } {
  let filled = 0;
  let total = 0;
  const emptyBands: number[] = [];
  table.values.forEach((months, i) => {
    const any = months.some((v) => v !== null);
    if (!any) emptyBands.push(i);
    for (const v of months) {
      total += 1;
      if (v !== null) filled += 1;
    }
  });
  return { filled, total, emptyBands };
}

