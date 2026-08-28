import { getCurve, dateFromDoy } from "./solar";
import { ozoneDU } from "./uv-model";
import {
  MIN_UVI,
  erythemaMinutes,
  estimateUVFromElevation,
  minutesForVitD,
  type SkinType,
} from "./vitd";
import { BANDS, BAND_TYPES, type Band } from "./suntime-routes";

/**
 * The figures the four "how long in the sun" pages print.
 *
 * EVERY NUMBER ON THOSE PAGES IS AN ASSERTION ABOUT `lib/`, so none of them is
 * written into `messages/*.json`: the copy interpolates what this module
 * computes, exactly as `lib/city-content.ts` already does for the city pages.
 * CLAUDE.md tabulates five claims that shipped stale and lived in production
 * for weeks because a figure was typed once and never re-derived — the footer's
 * "45°" threshold being the one that then got copied into `/methodology`.
 *
 * The model is not re-implemented here. Peak UV comes from the same hourly scan
 * `computeExposureFromCurve` performs, and the minutes from `minutesForVitD`
 * with that peak, so a number on these pages and the same number on a city page
 * cannot disagree.
 */

export interface SuntimeOptions {
  lat: number;
  lon: number;
  elevationM: number;
  areaFraction: number;
  age: number;
  targetIU: number;
}

/**
 * The reference the pages quote, and every part of it is stated on the page.
 *
 * Spec §9: a hidden assumption is what makes somebody else's figure look
 * authoritative, which is the defect these pages exist to correct. The AI
 * Overview answers "10 to 15 minutes" and one of its own sources quietly
 * qualifies itself with "Fitzpatrick II-III at ~40°N" — the qualification is the
 * whole answer, so here it is in the open.
 *
 * `targetIU` is THIS PRODUCT'S CHOICE, not a consensus: recommendations of 600,
 * 800 and 2000 IU all exist. The copy has to say so.
 *
 * Longitude 0 and sea level, because at a stated latitude they are the neutral
 * choice; both feed the ozone column and the altitude gain, and picking a city
 * would smuggle a place into a page that deliberately has none.
 */
export const REFERENCE: SuntimeOptions = {
  lat: 40,
  lon: 0,
  elevationM: 0,
  areaFraction: 0.25,
  age: 35,
  targetIU: 1000,
};

/**
 * The months the headline range is quoted over: March to September.
 *
 * Not the whole year, because at 40° the shoulder of the year has days with no
 * window at all and a range that swallowed them would read "5 minutes to
 * impossible". The impossible months are stated separately, which is the part
 * the AI Overview never gives.
 */
export const SEASON_MONTHS = [3, 4, 5, 6, 7, 8, 9];

const ALL_TYPES: SkinType[] = [1, 2, 3, 4, 5, 6];

/* ------------------------------------------------------------------------- *
 * Peak UV, once per day
 * ------------------------------------------------------------------------- */

/**
 * Peak UVI for each day of the year, or null on a day that never reaches
 * `MIN_UVI`.
 *
 * The scan reproduces `computeExposureFromCurve` exactly — one sample per whole
 * hour, `estimateUVFromElevation` with the day's ozone and the site's altitude,
 * the maximum taken over those 24 — rather than reading the true peak off the
 * five-minute curve, which would run slightly higher and make these pages
 * disagree with the city pages about the same instant.
 *
 * Computed once per option set and cached: it does not depend on skin type, so
 * the six types share it, and the four pages of a locale share it with the
 * other five locales' pages.
 */
const peakCache = new Map<string, (number | null)[]>();

function peakUviByDoy(opts: SuntimeOptions): (number | null)[] {
  const key = `${opts.lat}|${opts.lon}|${opts.elevationM}`;
  const cached = peakCache.get(key);
  if (cached) return cached;

  const peaks = Array.from({ length: 365 }, (_, i) => {
    const doy = i + 1;
    const curve = getCurve(opts.lat, opts.lon, doy, 0);
    const ctx = { ozoneDu: ozoneDU(opts.lat, opts.lon, doy), elevationM: opts.elevationM };
    let best = 0;
    for (let h = 0; h < 24; h++) {
      const pt = curve.find((p) => Math.floor(p.localHours) === h);
      const uvi = estimateUVFromElevation(pt?.elevation ?? 0, ctx);
      if (uvi > best) best = uvi;
    }
    return best < MIN_UVI ? null : best;
  });

  peakCache.set(key, peaks);
  return peaks;
}

/** 1-12 for a day of the year, on the reference year's UTC calendar. */
function monthOf(doy: number): number {
  return dateFromDoy(doy).getUTCMonth() + 1;
}

/* ------------------------------------------------------------------------- *
 * Per month
 * ------------------------------------------------------------------------- */

export interface MonthMinutes {
  /** 1-12. */
  month: number;
  /** Fewest minutes on the month's strongest day, or null if no day has a window. */
  minMinutes: number | null;
  /** Most minutes on the month's weakest viable day, or null with the above. */
  maxMinutes: number | null;
}

/**
 * Month by month, for one band.
 *
 * A month is impossible only when NOT ONE of its days reaches `MIN_UVI` — a
 * stricter reading than `cityYearProfile`'s "at least half the days", and the
 * right one here: that function decides whether a month belongs in a headline
 * claim about a city's season, while this one answers "can I do it in March at
 * all", where a single viable day makes the answer yes.
 *
 * `minMinutes` takes the band's quickest type on its strongest day and
 * `maxMinutes` the slowest type on its weakest viable day, so the pair brackets
 * everyone the page is written for.
 */
export function monthlyMinutes(band: Band, opts: SuntimeOptions = REFERENCE): MonthMinutes[] {
  const peaks = peakUviByDoy(opts);
  const [fastest, slowest] = BAND_TYPES[band] as [SkinType, SkinType];

  const rows: MonthMinutes[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    minMinutes: null,
    maxMinutes: null,
  }));

  for (let doy = 1; doy <= 365; doy++) {
    const uvi = peaks[doy - 1];
    if (uvi === null) continue;
    const row = rows[monthOf(doy) - 1];

    const quick = minutesForVitD(uvi, fastest, opts.areaFraction, opts.targetIU, opts.age);
    const slow = minutesForVitD(uvi, slowest, opts.areaFraction, opts.targetIU, opts.age);
    if (quick === null || slow === null) continue;

    row.minMinutes = row.minMinutes === null ? quick : Math.min(row.minMinutes, quick);
    row.maxMinutes = row.maxMinutes === null ? slow : Math.max(row.maxMinutes, slow);
  }

  return rows;
}

/**
 * The months with no viable day at this location — and it is deliberately NOT
 * parameterised by band.
 *
 * The window is decided by `MIN_UVI = 3`, which carries no skin-type term at
 * all, so the answer is identical for all six types. That is half of why there
 * are three pages and not six (spec §3): "here you cannot synthesize in winter"
 * would have been the same sentence six times.
 */
export function impossibleMonths(opts: SuntimeOptions = REFERENCE): number[] {
  const peaks = peakUviByDoy(opts);
  const viable = new Set<number>();
  for (let doy = 1; doy <= 365; doy++) {
    if (peaks[doy - 1] !== null) viable.add(monthOf(doy));
  }
  return Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !viable.has(m));
}

/* ------------------------------------------------------------------------- *
 * Per band
 * ------------------------------------------------------------------------- */

export interface TypeMinutes {
  type: SkinType;
  /** Fewest minutes across the season, or null if the season has no window. */
  minMinutes: number | null;
  /** Most minutes across the season. */
  maxMinutes: number | null;
}

export interface BandFigures {
  band: Band;
  types: [number, number];
  /** Fewest minutes anyone in this band needs during the season. */
  minMinutes: number;
  /** Most minutes anyone in this band needs during the season. */
  maxMinutes: number;
  /** Minutes to erythema at the same instant as `minMinutes`. */
  burnMinutesAtMin: number;
  /** Minutes to erythema at the same instant as `maxMinutes`. */
  burnMinutesAtMax: number;
  /**
   * `minutes ÷ burn minutes`, and it is the SAME NUMBER in all three bands.
   *
   * In `lib/vitd.ts` the characteristic time is `tau = 0.8·MED/uvi` and
   * `erythemaMinutes` is `MED/uvi`, so MED — the only term the skin type enters
   * through — cancels, leaving `0.8·−ln(1 − target/IU_sat)`. Measured at 0.2396
   * across all six types and stable under changes to area, target, age and
   * latitude.
   *
   * This is the measurement that cut the page count from six to three: six
   * pages would have been one page with a scaled number, which is thin content
   * by definition — the same error as the 438 city pages at 0.08 impressions
   * each. `lib/__tests__/suntime-content.test.ts` fails if it ever stops
   * holding, and that failure is a reason to revisit the page count, not the
   * assertion.
   */
  safetyRatio: number;
  /** The six individual types, kept as in-page detail (spec §3). */
  byType: TypeMinutes[];
}

/** The season's peak UVIs, strongest first, for one option set. */
function seasonPeaks(opts: SuntimeOptions): number[] {
  const peaks = peakUviByDoy(opts);
  const season = new Set(SEASON_MONTHS);
  const out: number[] = [];
  for (let doy = 1; doy <= 365; doy++) {
    const uvi = peaks[doy - 1];
    if (uvi !== null && season.has(monthOf(doy))) out.push(uvi);
  }
  return out;
}

/**
 * The headline range for one band, plus the six per-type figures.
 *
 * The strongest and weakest viable days of the season give the two ends. Burn
 * minutes are taken at those same two instants rather than at a nominal UVI, so
 * "X minutes for vitamin D, Y to burn" is one comparison and not two unrelated
 * ones.
 */
export function bandFigures(band: Band, opts: SuntimeOptions = REFERENCE): BandFigures {
  const peaks = seasonPeaks(opts);
  if (peaks.length === 0) {
    throw new Error(
      `No viable day between March and September at lat ${opts.lat}: these pages ` +
        `quote a season, so a location without one has nothing to print.`,
    );
  }
  const strongest = Math.max(...peaks);
  const weakest = Math.min(...peaks);

  const minutesAt = (uvi: number, type: SkinType) =>
    minutesForVitD(uvi, type, opts.areaFraction, opts.targetIU, opts.age);

  const byType: TypeMinutes[] = ALL_TYPES.map((type) => ({
    type,
    minMinutes: minutesAt(strongest, type),
    maxMinutes: minutesAt(weakest, type),
  }));

  const [fastest, slowest] = BAND_TYPES[band] as [SkinType, SkinType];
  const minMinutes = minutesAt(strongest, fastest)!;
  const maxMinutes = minutesAt(weakest, slowest)!;
  const burnMinutesAtMin = erythemaMinutes(strongest, fastest)!;
  const burnMinutesAtMax = erythemaMinutes(weakest, slowest)!;

  return {
    band,
    types: BAND_TYPES[band],
    minMinutes,
    maxMinutes,
    burnMinutesAtMin,
    burnMinutesAtMax,
    safetyRatio: minMinutes / burnMinutesAtMin,
    byType,
  };
}

/** All three bands, for the mother page and the cross-links. */
export function allBandFigures(opts: SuntimeOptions = REFERENCE): Record<Band, BandFigures> {
  return Object.fromEntries(BANDS.map((b) => [b, bandFigures(b, opts)])) as Record<
    Band,
    BandFigures
  >;
}
