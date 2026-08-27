import type { City } from "./types";
import type { SunTimes } from "./sun-times";
import type { ExposureResult } from "./vitd";
import type { CityYearProfile } from "./city-content";
import type { SunDayFigures } from "./schema";
import { getSunTimes } from "./sun-times";
import {
  getCurve, dateFromDoy, doyFromMonthDay, fmtTime, fmtDayLength, dayLengthMinutes,
  DOY_REFERENCE_YEAR,
} from "./solar";
import { computeExposureFromCurve } from "./vitd";
import { ozoneDU } from "./uv-model";
import { zonedDate } from "./timezone";
import { verdictMonths } from "./city-copy";
import { sunRegime, type SunRegime, type SunFaqEntry } from "./sun-copy";

/**
 * The city hub (`/amanecer/madrid`): what the sun is doing in one city TODAY.
 *
 * Its subject is deliberately not "what time is sunrise" — that is a single
 * data point, the ground the AI Overview already owns and where our measured
 * click-through is 0.17%. The subject is the vitamin D window: the hours when
 * clear-sky UVI reaches MIN_UVI (3, `lib/vitd.ts`), which no ephemeris rival
 * publishes. Sun times are the supporting data.
 *
 * FRESHNESS, AND HOW BIG THE PROBLEM ACTUALLY IS.
 *
 * ISR gives no upper bound on staleness. After `revalidate` elapses the next
 * request is served the STALE copy while regeneration happens behind it, so the
 * HTML a reader gets is as old as the last request that triggered a
 * regeneration — for 240 brand-new low-traffic URLs that gap is days or weeks,
 * not an hour. An earlier version of this comment claimed the worst case was
 * "one hour off". That was a per-DAY bound (the window moves at most one hour
 * from one day to the next) mistaken for a cache bound. Across a month the real
 * drift is the full seasonal amplitude, up to a regime inversion: Oslo has a
 * 12:00–16:00 window on 16 August and none at all on 16 September; London loses
 * its window between mid-September and mid-October.
 *
 * Two defences, because neither alone is enough.
 *
 * FIRST, the staleness IS bounded, but from outside ISR: the cron at
 * `/api/revalidate-today` pushes a regeneration of all 240 hubs once a day, so
 * the served HTML is at most a day old whether or not anyone fetched it. At one
 * day the window moves by at most an hour and the regime cannot invert, which is
 * what makes the "at worst an hour" claim true — it was false while the only
 * mechanism was ISR, which regenerates on request and therefore never for a page
 * nobody requests.
 *
 * SECOND, and independently, the design removes the surfaces on which staleness
 * could publish a false statement even if that cron stopped running:
 *
 *   1. THE METADATA STATES NO DAY'S FIGURES. `metaTitle`/`metaDescription` do
 *      not branch on regime and carry no window, no minutes and no clock time —
 *      they describe what the page answers and by which criterion. That is the
 *      string a search engine quotes and an AI Overview ingests, and no browser
 *      ever corrects it, so it is the one surface that had to be made
 *      unfalsifiable rather than merely corrected. The cost is a snippet without
 *      numbers; the alternative was a snippet whose numbers could be a season
 *      out of date.
 *   2. THE FAQPage MARKUP CARRIES ONLY THE YEAR ANSWER. `yearFaq` comes from
 *      `cityYearProfile`, which walks all 365 days: it is a property of the
 *      PLACE and stays true however long the HTML sits in a cache. The two
 *      day-dependent questions stay visible to the reader but are kept out of
 *      the structured data, because that is handed to Google verbatim and never
 *      revisited.
 *   3. EVERY DAY-DEPENDENT STRING IS CORRECTED IN THE BROWSER, FROM ONE
 *      RECOMPUTATION. The lede, the stat panel and the two day-dependent FAQ
 *      answers all read the same `TodayProvider` state, computed on mount from
 *      the CITY's own calendar date. One computation, so a corrected panel
 *      cannot sit above a stale answer that contradicts it.
 *   4. NO SERVER-RENDERED STRING NAMES A CALENDAR DATE, for the same reason —
 *      WITH ONE EXCEPTION, AND IT IS DELIBERATE. The JSON-LD `Event` nodes carry
 *      `startDate`, so a hub's structured data does name a day: the day it was
 *      rendered for (`todayEventDays` below, emitted by `sunPageGraph`).
 *
 *      Why it is worth keeping. Everything above bounds the DAMAGE staleness can
 *      do; none of it tells you WHETHER a hub is stale, and `revalidatePath`
 *      returns `void`, so the cron that does the bounding could stop working and
 *      keep answering 200. `/api/revalidate-today` therefore reads this date
 *      back from three sampled hubs and fails the run when the day is neither
 *      today's nor yesterday's (`lib/hub-freshness.ts`).
 *
 *      Be precise about what the Event does and does not buy, because an earlier
 *      draft of this paragraph claimed it was "the only machine-readable
 *      statement" of a hub's freshness and that was simply false. Defence 3 says
 *      the day-dependent strings are corrected in the browser — it does not say
 *      they are absent from the server render, and they are not: the served HTML
 *      already carries today's window, today's minutes and today's sunrise and
 *      sunset. Freshness is checkable from those figures alone, with no dated
 *      node anywhere.
 *
 *      The Event is kept because that check would be much worse, not because it
 *      is the only one available. Comparing prose figures means reproducing the
 *      whole solar and UV pipeline in the checker, parsing localised strings in
 *      six languages, and — the part that actually breaks it — accepting that
 *      two adjacent days often round to the SAME window and minute count, so a
 *      hub frozen yesterday would pass. One ISO date in one structured node is a
 *      single parse, an exact comparison, and no second implementation of the
 *      model. Removing it would not make freshness unobservable; it would make
 *      the observation expensive and unreliable enough that nobody would keep it
 *      working — which, on the evidence of the 53- and 58-day silent-secret
 *      incidents in CLAUDE.md, is the same outcome by a slower route.
 *
 *      The exception is also the mildest possible one. A stale Event is not
 *      FALSE: Oslo's sunrise on 2026-08-22 was 05:51 and always will be. It is
 *      merely DATED — a frozen hub would keep advertising a past day's event
 *      instead of today's. Compare what is not allowed here: a stale
 *      `metaTitleNone` would tell a search engine there is no vitamin D window
 *      in a city that has an eight-hour one.
 *
 * Worst case, stated plainly: a reader without JavaScript, on the first request
 * after a long gap, reads body prose whose window belongs to whatever day the
 * cache entry was built for — potentially a different season. The metadata
 * cannot be wrong, because it asserts nothing about today; the structured data
 * cannot be wrong either, but it can be visibly out of date, and that is what
 * makes it checkable. Bounding the body prose too would need a hard cache expiry
 * (Next 16 `cacheComponents` + `cacheLife`, an app-wide change) or a daily
 * revalidation cron; both are out of scope here and neither is a prerequisite
 * for the surfaces above.
 *
 * `messages/__tests__/sun-today-copy.test.ts` enforces (1) and (4) key by key,
 * `lib/__tests__/sun-today.test.ts` enforces (2) and pins the one dated Event
 * (exactly one calendar day, and it is the render's own), and
 * `components/__tests__/TodayWindow.test.tsx` enforces (3).
 */

/** The default reader these pages are written for: Fitzpatrick III, 25% of the
 * body exposed, 1000 IU — the same profile `monthData` in `lib/sun-copy.ts` and
 * `citySeasonalWindows` in `lib/city-content.ts` use, so the hub, the month
 * pages and the city pages cannot disagree about the same city. */
const DEFAULT_SKIN = 3 as const;
const DEFAULT_AREA = 0.25;
const DEFAULT_TARGET_IU = 1000;

export interface TodayInZone {
  year: number;
  /** 0-based, like `Date`. */
  monthIndex: number;
  day: number;
  /**
   * Day number in the site's fixed reference year (`DOY_REFERENCE_YEAR`), which
   * is what every solar helper here takes. In a leap year 29 February maps onto
   * 1 March — one day of drift on one day every four years, against tables that
   * are themselves ±1–2 min across years.
   */
  doy: number;
}

/** Today's calendar date where the CITY is, from an instant (default: now). */
export function cityToday(city: City, at: Date = new Date()): TodayInZone {
  const { year, monthIndex, day } = zonedDate(at, city.timezone, city.tz);
  return { year, monthIndex, day, doy: doyFromMonthDay(monthIndex, day) };
}

export interface SunTodayData {
  today: TodayInZone;
  sun: SunTimes;
  /** Null when clear-sky UVI never reaches MIN_UVI on this day. */
  exposure: ExposureResult | null;
  regime: SunRegime;
  /** Minutes of daylight, or null on a polar day/night. */
  dayLengthMin: number | null;
}

/**
 * Today's sun and synthesis window for a city.
 *
 * Every figure comes from the modules that already compute it — `getSunTimes`
 * for the clock times, `getCurve` + `computeExposureFromCurve` (UV from
 * `uvIndex`, ozone from `ozoneDU`) for the window. Nothing is recomputed here
 * and nothing is a constant.
 */
export function sunTodayData(city: City, today: TodayInZone): SunTodayData {
  const { lat, lon, tz, timezone } = city;
  const elevationM = city.elevation ?? 0;
  const sun = getSunTimes(lat, lon, dateFromDoy(today.doy), timezone, tz);
  const exposure = computeExposureFromCurve(
    getCurve(lat, lon, today.doy, tz, timezone),
    DEFAULT_SKIN, DEFAULT_AREA, DEFAULT_TARGET_IU, null,
    { ozoneDu: ozoneDU(lat, lon, today.doy), elevationM },
  );

  return {
    today,
    sun,
    exposure,
    // One day, so `sunRegime`'s "any polar day in the range" reduces to this one.
    // Shared with the month pages so both trees classify a city identically.
    regime: sunRegime(
      [{ day: today.day, civilDawn: sun.civilDawn, sunrise: sun.sunrise, sunset: sun.sunset, civilDusk: sun.civilDusk, polar: sun.polar }],
      exposure,
    ),
    dayLengthMin: dayLengthMinutes(sun.sunrise, sun.sunset),
  };
}

/**
 * The one dated surface the hub publishes: the day its JSON-LD Events belong to.
 *
 * `sunPageGraph` stamps every Event instant with `DOY_REFERENCE_YEAR`, because
 * that is the year every table on this site is computed for. On a page whose
 * subject is today, publishing an Event dated 2026 while the reader is in 2027
 * would be a fabricated instant, so the Events are emitted only while the two
 * years agree; the Place, WebPage, BreadcrumbList and FAQPage nodes are
 * unaffected.
 *
 * WHEN `DOY_REFERENCE_YEAR` FALLS BEHIND, EVERY HUB SILENTLY LOSES ITS Event
 * NODES — both the alpenglow-parity signal and, now, the freshness signal the
 * cron checks. That used to be a defect nothing would shout about. It is now
 * audible: with no dated Event anywhere in the sample, `/api/revalidate-today`
 * can prove nothing and returns 500, so the cron invocation goes red. Bumping
 * the constant is still the fix.
 *
 * BUT ONLY ONCE THE CALENDAR HAS ACTUALLY REACHED THE NEW YEAR. The comparison
 * above is symmetric: it drops the Events when the reader's year is AHEAD of the
 * constant and equally when it is BEHIND. Bumping to 2027 in August 2026 does
 * not pre-empt the January failure, it starts it four months early — every hub
 * loses its Events on the next deploy, `lib/hub-freshness.ts` reads no dated
 * Event in any of the three samples, `hubFreshnessOk` is false, and the cron
 * goes red daily from that deploy until 1 January. The bump belongs in the last
 * days of December, in the same deploy that publishes the new year's figures.
 *
 * Lives here rather than in the page so the test that pins this decision
 * exercises the decision itself, not a copy of it.
 */
export function todayEventDays(today: TodayInZone, sun: SunTimes): SunDayFigures[] {
  if (today.year !== DOY_REFERENCE_YEAR) return [];
  return [{ day: today.day, sunrise: sun.sunrise, sunset: sun.sunset }];
}

type Values = Record<string, string | number>;

export interface TodayWindowCopy {
  ledeKey: "lede" | "ledeNone" | "ledePolar";
  windowKey: "faqWindowASynthesis" | "faqWindowANone" | "faqWindowAPolar";
  /** `{city}`, plus the window figures when there is a window. */
  values: Values;
  sunKey: "faqSunA" | "faqSunAPolar";
  sunValues: Values;
  /** Formatted for the stat panel; null where the page prints a dash instead. */
  windowStart: string | null;
  windowEnd: string | null;
  minutes: number | null;
  sunrise: string | null;
  sunset: string | null;
}

/**
 * The part of the page's copy that depends on WHICH DAY it is — and therefore
 * the part the browser recomputes on mount (`components/TodayWindow.tsx`).
 *
 * Split out of `sunTodayCopy` so the server and the client pick their strings
 * through the same function. A second mapping from regime to message key is
 * exactly how a page ends up promising vitamin D above a paragraph that says
 * there is none.
 */
export function todayWindowCopy(cityName: string, data: SunTodayData): TodayWindowCopy {
  const { sun, exposure, regime, dayLengthMin } = data;
  const city = cityName;
  const hasSun = sun.sunrise !== null && sun.sunset !== null && dayLengthMin !== null;

  return {
    ledeKey: regime === "synthesis" ? "lede" : regime === "polar" ? "ledePolar" : "ledeNone",
    windowKey:
      regime === "synthesis" ? "faqWindowASynthesis"
      : regime === "polar" ? "faqWindowAPolar"
      : "faqWindowANone",
    values: exposure
      ? {
          city,
          windowStart: fmtTime(exposure.windowStart),
          windowEnd: fmtTime(exposure.windowEnd),
          minutes: Math.round(exposure.minutesNeeded),
        }
      : { city },
    sunKey: hasSun ? "faqSunA" : "faqSunAPolar",
    sunValues: hasSun
      ? {
          city,
          sunrise: fmtTime(sun.sunrise!),
          sunset: fmtTime(sun.sunset!),
          dayLength: fmtDayLength(dayLengthMin!),
        }
      : { city },
    windowStart: exposure ? fmtTime(exposure.windowStart) : null,
    windowEnd: exposure ? fmtTime(exposure.windowEnd) : null,
    minutes: exposure ? Math.round(exposure.minutesNeeded) : null,
    sunrise: hasSun ? fmtTime(sun.sunrise!) : null,
    sunset: hasSun ? fmtTime(sun.sunset!) : null,
  };
}

export interface SunTodayCopy {
  regime: SunRegime;
  /**
   * `{city}` and nothing else. The metadata is the surface no browser revisits,
   * so it states the page's criterion rather than the day's answer — see the
   * module comment.
   */
  metaValues: Values;
  headingValues: Values;
  /**
   * The window and the sun times. Rendered by `components/TodayFaq.tsx` from
   * the same recomputation as the stat panel, and deliberately absent from the
   * FAQPage markup: structured data is read once and never corrected.
   */
  dayFaq: SunFaqEntry[];
  /** True of the place, not of today — so it is safe in the FAQPage markup. */
  yearFaq: SunFaqEntry;
}

export interface SunTodayCopyInput {
  locale: string;
  /** The city's name in this page's locale — what the page prints. */
  cityName: string;
  data: SunTodayData;
  profile: CityYearProfile;
  /** The contiguous band of months with a window, or null (all year / never). */
  band: { start: number; end: number } | null;
}

/**
 * Which strings the page renders, with the values each one needs — the same
 * key/value shape `sunPageCopy` uses.
 *
 * Split into `dayFaq` and `yearFaq` because the two have different lifetimes,
 * and the split is what keeps a cached page honest: `yearFaq` is safe to hand
 * to a crawler as structured data, `dayFaq` is not and is corrected in the
 * browser instead.
 *
 * Note what is NOT here: a date, a month name for "today", a year. Those are
 * the claims a cached page cannot stand behind (see the module comment).
 */
export function sunTodayCopy({ locale, cityName, data, profile, band }: SunTodayCopyInput): SunTodayCopy {
  const { regime } = data;
  const city = cityName;
  const day = todayWindowCopy(cityName, data);
  const windowValues = day.values;

  // The year answer is a property of the place, not of today: it comes from
  // `cityYearProfile`, which walks all 365 days against the ozone- and
  // altitude-aware threshold. It is the one claim on this page that stays true
  // however long the HTML sits in a cache.
  const yearEntry: SunFaqEntry = profile.allYear
    ? { qKey: "faqYearQ", qValues: { city }, aKey: "faqYearAAll", aValues: { city } }
    : profile.neverPossible || band === null
      ? { qKey: "faqYearQ", qValues: { city }, aKey: "faqYearANever", aValues: { city } }
      : {
          qKey: "faqYearQ",
          qValues: { city },
          aKey: "faqYearARange",
          // The superset of month forms every locale may need: ru declines the
          // start after `с`, lt declines both, fr carries the elided `de`/`d'`.
          aValues: { city, ...verdictMonths(locale, band.start - 1, band.end - 1) },
        };

  const sunEntry: SunFaqEntry = {
    qKey: "faqSunQ", qValues: { city }, aKey: day.sunKey, aValues: day.sunValues,
  };

  const windowEntry: SunFaqEntry = {
    qKey: "faqWindowQ", qValues: { city }, aKey: day.windowKey, aValues: windowValues,
  };

  return {
    regime,
    // No regime branch and no figures. A cached `metaTitleNone` asserting "no
    // vitamin D today" for a city with an eight-hour window is exactly the
    // failure this page cannot afford, and the title is the artefact the whole
    // page exists to win.
    metaValues: { city },
    headingValues: { city },
    // Window first: it is the page's subject. The clock times are support.
    dayFaq: [windowEntry, sunEntry],
    yearFaq: yearEntry,
  };
}
