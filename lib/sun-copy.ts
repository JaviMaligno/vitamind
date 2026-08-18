import type { DailySunTimes } from "@/lib/sun-times";
import type { ExposureResult } from "@/lib/vitd";
import type { CompassPoint, DueSide } from "@/lib/compass";
import { dailySunTimes, getSunTimes } from "@/lib/sun-times";
import {
  getCurve, doyFromMonthDay, dateFromDoy, fmtTime, fmtDayLength, dayLengthMinutes,
  sunDirection, daysInMonth,
} from "@/lib/solar";
import { compassPoint, offsetFromDueEast } from "@/lib/compass";
import { computeExposureFromCurve } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

/**
 * The figures a sunrise month page states, and which variant of each string
 * states them.
 *
 * The month page promises three different things depending on the month: a
 * vitamin D window where one exists, the reason there is none where there
 * isn't, and a day-by-day caveat where the sun does not rise or set at all.
 * Metadata and the FAQ both have to pick the same one — a title promising
 * vitamin D above a page that answers "no hay" is the bounce this copy exists
 * to avoid.
 *
 * Everything here is a selection over `monthData`'s own return value. No figure
 * is recomputed, none is a constant, and none is copied from other copy on the
 * site — which is exactly how the footer came to claim a 45° threshold the code
 * had abandoned.
 */

export type SunRegime = "synthesis" | "none" | "polar";

/** A formatted clock time, or nothing at all — never the em dash the table prints. */
const hhmm = (h: number) => fmtTime(h);

/**
 * Below this, a month's drift is not a direction this model can claim.
 *
 * `lib/solar.ts` documents its `declination` as the one-term approximation,
 * worth "~1-2° of bearing" and more the further from the equator. A drift of
 * one degree across a solstice month is inside that, so naming a side for it
 * would be stating a direction the maths does not support — the copy says the
 * points barely move instead. Madrid in December drifts 1°; Sydney in June, 1°.
 */
export const DRIFT_MIN_DEG = 2;

/**
 * Where the sun comes up and goes down over one month, for one latitude.
 *
 * The mid-month anchor is day 15, the same day every other mid-month figure on
 * the page uses (`monthData.mid`, the FAQ's "a mitad de mes"), so the direction
 * and the clock times describe the same day.
 *
 * NO LONGITUDE AND NO TIMEZONE, because `sunDirection` takes neither: longitude
 * moves WHEN a sunrise happens, not WHERE. A signature that accepted them would
 * imply an accuracy the model does not have.
 *
 * Returns `null` when any day of the month lacks a sunrise. That is the same
 * all-or-nothing rule `sunRegime` applies — a month that turns polar halfway
 * through has no single sunrise direction any more than it has a single
 * sunrise time — and `sun-direction.test.ts` sweeps latitude to hold the two in
 * agreement, so the page can never print a time with no direction beside it or
 * a direction on a day whose table prints an em dash.
 */
export interface MonthDirection {
  /** Whole degrees clockwise from TRUE north, mid-month. */
  sunriseBearing: number;
  sunsetBearing: number;
  sunrisePoint: CompassPoint;
  sunsetPoint: CompassPoint;
  /** How far mid-month sunrise sits from due east — and sunset from due west. */
  offDegrees: number;
  offSide: DueSide;
  /** Whole degrees the sunrise point walks between day 1 and the last day. */
  driftDegrees: number;
  drift: "north" | "south" | "none";
}

export function monthDirection(lat: number, monthIndex: number): MonthDirection | null {
  const lastDay = daysInMonth(monthIndex);
  const daily = Array.from({ length: lastDay }, (_, i) =>
    sunDirection(lat, doyFromMonthDay(monthIndex, i + 1)),
  );
  if (daily.some((d) => d === null)) return null;

  const first = daily[0]!;
  // Every month has at least 28 days, so the 15th is always in range.
  const mid = daily[14]!;
  const last = daily[lastDay - 1]!;

  const drift = last.sunriseBearing - first.sunriseBearing;
  const driftDegrees = Math.round(Math.abs(drift));
  const { degrees: offDegrees, side: offSide } = offsetFromDueEast(mid.sunriseBearing);

  return {
    // Rounded for display only; the labels come from the unrounded bearing.
    // The two cannot disagree: sector boundaries are half-degrees, so rounding
    // never moves a bearing across one (asserted in `compass.test.ts`). The
    // `% 360` catches a sunset at 359.6°, which would otherwise print as 360°.
    sunriseBearing: Math.round(mid.sunriseBearing) % 360,
    sunsetBearing: Math.round(mid.sunsetBearing) % 360,
    sunrisePoint: compassPoint(mid.sunriseBearing),
    sunsetPoint: compassPoint(mid.sunsetBearing),
    offDegrees,
    offSide,
    driftDegrees,
    // A sunrise bearing FALLING through the month walks from the east toward
    // the north; the sunset mirrors it, so one figure describes both ends.
    drift: driftDegrees < DRIFT_MIN_DEG ? "none" : drift < 0 ? "north" : "south",
  };
}

export function monthData(
  lat: number,
  lon: number,
  tz: number,
  timezone: string | undefined,
  elevationM: number,
  monthIndex: number,
) {
  const days = dailySunTimes(lat, lon, monthIndex, timezone, tz);
  const first = days[0];
  const last = days[days.length - 1];
  const dayLen = (d: { sunrise: number | null; sunset: number | null }) =>
    dayLengthMinutes(d.sunrise, d.sunset);

  const firstLen = dayLen(first);
  const lastLen = dayLen(last);
  const deltaMin = firstLen !== null && lastLen !== null ? Math.round(lastLen - firstLen) : 0;

  const mid = getSunTimes(lat, lon, dateFromDoy(doyFromMonthDay(monthIndex, 15)), timezone, tz);

  const doy15 = doyFromMonthDay(monthIndex, 15);
  const exposure = computeExposureFromCurve(
    getCurve(lat, lon, doy15, tz, timezone), 3, 0.25, 1000, null,
    { ozoneDu: ozoneDU(lat, lon, doy15), elevationM },
  );

  return { days, first, last, deltaMin, mid, exposure, dayLen, direction: monthDirection(lat, monthIndex) };
}

export type MonthData = ReturnType<typeof monthData>;

/**
 * The same three lines `lib/sun-prose.ts` decides its regime with (:74-81),
 * evaluated from what the page already has.
 *
 * Deliberately not an import of `sunProse`: that module is gated behind the
 * Phase 2 treated/control split, and calling it for everyone would run the
 * experiment's code on control pages. A unit test asserts the two never
 * disagree.
 *
 * One polar day in the month is enough — a month that turns polar halfway
 * through has no single sunrise time either.
 */
export function sunRegime(days: DailySunTimes[], exposure: ExposureResult | null): SunRegime {
  const polar = days.some((d) => d.polar !== null);
  const hasWindow = exposure !== null && exposure.windowEnd > exposure.windowStart;
  return polar ? "polar" : hasWindow ? "synthesis" : "none";
}

type Values = Record<string, string | number>;

export interface SunFaqEntry {
  qKey: string;
  qValues: Values;
  aKey: string;
  aValues: Values;
}

export interface SunPageCopy {
  regime: SunRegime;
  metaTitleKey: "metaTitle" | "metaTitleNone" | "metaTitlePolar";
  metaDescriptionKey: "metaDescription" | "metaDescriptionNone" | "metaDescriptionPolar";
  metaValues: Values;
  headingValues: Values;
  faq: SunFaqEntry[];
}

/**
 * Which strings the page renders, with the values each one needs.
 *
 * Returned as keys and values rather than finished sentences so the visible
 * FAQ section and the FAQPage JSON-LD are built from one list: Google requires
 * the answers it marks up to be on the page, and an invisible FAQ is what made
 * Search Appearance read "Sin datos" for this markup.
 *
 * `compassIn` is the one value this module cannot produce, because the compass
 * point is an identifier and every locale needs a different preposition in
 * front of it ("à l'est" but "au nord-est"). The caller resolves it from the
 * `compass.in` namespace. It is required rather than optional so a caller
 * cannot silently drop the direction answer by forgetting it.
 */
export function sunPageCopy({
  cityName, month, data, compassIn,
}: {
  cityName: string;
  month: string;
  data: MonthData;
  compassIn: (point: CompassPoint) => string;
}): SunPageCopy {
  const { days, first, last, deltaMin, mid, exposure, dayLen, direction } = data;
  const regime = sunRegime(days, exposure);
  const city = cityName;
  const trend = deltaMin > 3 ? "longer" : deltaMin < -3 ? "shorter" : "other";
  const cityMonth: Values = { city, month };

  if (regime === "polar") {
    /**
     * first/last sunrise, mid day length and both twilights are all null here,
     * so the four figure questions have nothing to answer with and the polar
     * one replaces them. The vitamin D answer asserts nothing in either
     * direction: Tromso in June is polar on all 30 days AND still returns a
     * 12:00–15:00 window, so "no synthesis" would be false.
     */
    return {
      regime,
      metaTitleKey: "metaTitlePolar",
      metaDescriptionKey: "metaDescriptionPolar",
      metaValues: { ...cityMonth },
      headingValues: { ...cityMonth },
      faq: [
        { qKey: "faqPolarQ", qValues: { ...cityMonth }, aKey: "faqPolarA", aValues: { month, city } },
        { qKey: "faqVitdQ", qValues: { ...cityMonth }, aKey: "faqVitdAPolar", aValues: { month, city } },
      ],
    };
  }

  /**
   * Outside the polar regime every day of the month has a sunrise and a sunset,
   * so these are non-null — but civil dawn and dusk still are not: above ~60°
   * in midsummer the sun never drops 6° below the horizon, which is what the
   * two NoNight answers are for.
   */
  const midLen = dayLen(mid);
  const dawn = mid.civilDawn;
  const dusk = mid.civilDusk;

  const faq: SunFaqEntry[] = [
    /**
     * FIRST, and deliberately. Search Console over 28 days: queries asking for a
     * DIRECTION converted at 9.1% (1 click / 11 impressions), the highest CTR
     * pattern in the whole report, against 0.17% for the clock-time queries this
     * tree is otherwise full of. It is also the only question here that no
     * ephemeris rival answers for a city and a month at once, so it leads the
     * visible list and the FAQPage markup built from it.
     *
     * Absent on a polar month: `monthDirection` returns null when any day of the
     * month has no sunrise, so there is no one direction to name.
     */
    ...(direction
      ? [{
          qKey: "faqDirectionQ",
          qValues: { ...cityMonth },
          aKey: "faqDirectionA",
          aValues: {
            month, city,
            sunrisePoint: compassIn(direction.sunrisePoint),
            sunsetPoint: compassIn(direction.sunsetPoint),
            sunriseBearing: direction.sunriseBearing,
            sunsetBearing: direction.sunsetBearing,
            offDegrees: direction.offDegrees,
            offSide: direction.offSide,
            driftDegrees: direction.driftDegrees,
            drift: direction.drift,
          },
        }]
      : []),
    {
      qKey: "faqDeltaQ",
      qValues: { trend, city, month },
      aKey: "faqDeltaA",
      aValues: {
        trend, month, minutes: Math.abs(deltaMin), city,
        firstSunrise: hhmm(first.sunrise!), firstSunset: hhmm(first.sunset!),
        lastDay: days.length,
        lastSunrise: hhmm(last.sunrise!), lastSunset: hhmm(last.sunset!),
      },
    },
    {
      qKey: "faqLightQ",
      qValues: { ...cityMonth },
      aKey: "faqLightA",
      aValues: {
        month, dayLength: fmtDayLength(midLen!), city,
        sunrise: hhmm(mid.sunrise!), sunset: hhmm(mid.sunset!), days: days.length,
      },
    },
    dawn !== null
      ? {
          qKey: "faqDawnQ",
          qValues: { ...cityMonth },
          aKey: "faqDawnA",
          aValues: { month, dawn: hhmm(dawn), city, sunrise: hhmm(mid.sunrise!) },
        }
      : {
          // Reykjavik in June and July: the sun never drops 6° below the
          // horizon, so there is no dawn time to print.
          qKey: "faqDawnQ",
          qValues: { ...cityMonth },
          aKey: "faqDawnANoNight",
          aValues: { month, city },
        },
    dusk !== null
      ? {
          qKey: "faqDarkQ",
          qValues: { ...cityMonth },
          aKey: "faqDarkA",
          aValues: { month, city, sunset: hhmm(mid.sunset!), dusk: hhmm(dusk) },
        }
      : {
          qKey: "faqDarkQ",
          qValues: { ...cityMonth },
          aKey: "faqDarkANoNight",
          aValues: { month, city, sunset: hhmm(mid.sunset!) },
        },
    exposure
      ? {
          qKey: "faqVitdQ",
          qValues: { ...cityMonth },
          aKey: "faqVitdASynthesis",
          aValues: {
            month,
            windowStart: hhmm(exposure.windowStart),
            windowEnd: hhmm(exposure.windowEnd),
            city,
            minutes: Math.round(exposure.minutesNeeded),
          },
        }
      : {
          qKey: "faqVitdQ",
          qValues: { ...cityMonth },
          aKey: "faqVitdANone",
          aValues: { month, city },
        },
  ];

  return {
    regime,
    metaTitleKey: regime === "synthesis" ? "metaTitle" : "metaTitleNone",
    metaDescriptionKey: regime === "synthesis" ? "metaDescription" : "metaDescriptionNone",
    metaValues: {
      month, city,
      firstSunrise: hhmm(first.sunrise!), firstSunset: hhmm(first.sunset!),
      trend,
    },
    headingValues: { ...cityMonth },
    faq,
  };
}
