import type { DailySunTimes } from "@/lib/sun-times";
import type { ExposureResult } from "@/lib/vitd";
import { dailySunTimes, getSunTimes } from "@/lib/sun-times";
import { getCurve, doyFromMonthDay, dateFromDoy, fmtTime, fmtDayLength, dayLengthMinutes } from "@/lib/solar";
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

  return { days, first, last, deltaMin, mid, exposure, dayLen };
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
 */
export function sunPageCopy({
  cityName, month, data,
}: { cityName: string; month: string; data: MonthData }): SunPageCopy {
  const { days, first, last, deltaMin, mid, exposure, dayLen } = data;
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
