/**
 * Fingerprints of the content that the two frozen-lastmod page families publish.
 *
 * WHY THIS EXISTS. `app/sitemap.ts` used to stamp `new Date()` on all 3612
 * entries, so every deploy told five search engines that every URL on the site
 * had changed — including 2880 month pages whose own `changeFrequency` says
 * `yearly`. Those two families now publish a hand-declared date
 * (`lib/content-revision.ts`) instead of the build clock, which is truthful and
 * stops asking for a full re-crawl on every unrelated commit.
 *
 * That trade creates a hazard, and this module is the thing that closes it: a
 * copy fix to `messages/*.json` now ships to 2880 pages that the sitemap
 * announces as unchanged, and nobody is told. CLAUDE.md has a table of five
 * stale factual claims that lived in production for weeks or months, none found
 * by the person who wrote them. Announcing a fix as "nothing changed" is how a
 * sixth would join them: the fix ships, the engines keep serving the snippet
 * they already have, and the wrong number stays in the SERP.
 *
 * So the guard hashes what each family renders and fails
 * `lib/__tests__/content-revision.test.ts` when the hash moves without the
 * declared revision moving with it.
 *
 * NODE-ONLY, ON PURPOSE. It reads `messages/*.json` from disk and uses
 * `node:crypto`, so it must never be imported by a page or a component — the
 * value a page needs is the *declared* date, which lives in the tiny
 * `lib/content-revision.ts` that `app/sitemap.ts` imports. Keeping the hasher
 * out of that module is what keeps six message files out of the sitemap's
 * bundle.
 *
 * WHAT IS HASHED, and why each piece:
 *
 * - `copy.<locale>` — the message namespaces the family's route file actually
 *   reads, parsed and re-serialized canonically (so re-indenting a JSON file is
 *   not a content change). The namespace lists below mirror the
 *   `getTranslations` calls in the route files, and the guard test greps those
 *   files to prove the mirror is still accurate.
 * - `cities` — identity and geometry of the cities the family covers. Adding a
 *   city changes existing pages, not just the new URL: every page carries a
 *   "nearby cities" block built from this list.
 * - `figures` — the numbers the family PRINTS, produced by calling the very
 *   helpers the pages call (`monthData`, `citySeasonalWindows`,
 *   `cityYearProfile`) and formatting them through `fmtTime`/`fmtDayLength`.
 *   This is what catches a change in the solar or UV math, which no amount of
 *   message hashing would see.
 * - `constants` — `DOY_REFERENCE_YEAR` (the year every table on the site is
 *   computed for) and, for the month pages, which cities are in the phase-2
 *   treated group (the gate on whether the extractable prose paragraph renders
 *   at all).
 *
 * WHAT IS DELIBERATELY NOT HASHED:
 *
 * - The SOURCE TEXT of `lib/*.ts`. It was the obvious candidate and it is the
 *   wrong one in this repo: comments here are long, argumentative and rewritten
 *   constantly, so source hashing would demand a revision bump for edits that
 *   change nothing a reader sees. A guard that cries wolf gets bumped blindly,
 *   which is worse than no guard. The `figures` part covers the case that
 *   matters — a behaviour change in the math — by hashing the output instead.
 * - Anything derived from `Intl` (localized month names, `monthName`,
 *   `monthGenitive`). Those strings come from the runtime's ICU data, so
 *   hashing them would make the fingerprint depend on the Node build and fail
 *   in CI while passing locally.
 * - `nav`, `notifications`, `install` and the other chrome namespaces on the
 *   city page. They are shared with the app pages, which keep a build-time
 *   lastmod precisely because there is no cheap fingerprint of "the whole app"
 *   — a chrome edit is therefore already announced there. (The month page's
 *   `nav` IS hashed: it reads `nav.cities` into the page's JSON-LD, so the
 *   string is part of what that family publishes.)
 *
 * ONE THING THE `figures` PART WILL DO, and it is not a bug: if Node's bundled
 * tzdata changes a timezone rule, the printed clock times for the affected
 * cities change and this hash moves. That is a real content change — the pages
 * really will render different times after the upgrade — so the answer is to
 * bump the revision, not to loosen the hash.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { routing } from "@/i18n/routing";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug, localizedCityName } from "@/lib/city-routes";
import { SUNRISE_CITIES } from "@/lib/sun-routes";
import { DOY_REFERENCE_YEAR, fmtTime, fmtDayLength } from "@/lib/solar";
import { monthData } from "@/lib/sun-copy";
import { sunProse } from "@/lib/sun-prose";
import { monthlySunTimes } from "@/lib/sun-times";
import { cityYearProfile, citySeasonalWindows } from "@/lib/city-content";
import { isTreated } from "@/lib/phase2-cities";
import type { City } from "@/lib/types";

/**
 * Message namespaces the month page reads
 * (`app/[locale]/[cityPrefix]/[city]/[month]/page.tsx`). `sunToday` and
 * `compass` are in the list because that page renders them too — the direction
 * section and the hub cross-link — not only `sunrisePage`.
 */
export const SUN_MONTH_NAMESPACES = [
  "sunrisePage", "sunToday", "sunTimes", "nav", "compass",
] as const;

/**
 * Message namespaces the city page reads
 * (`app/[locale]/[cityPrefix]/[city]/page.tsx`). Short because that page passes
 * strings down as props rather than letting its components translate: only
 * `SunTimesPanel` (`sunTimes`) and the interactive toggle (`notifications`,
 * `install` — chrome, see the header) translate on their own.
 */
export const CITY_PAGE_NAMESPACES = ["cityPage", "sunTimes"] as const;

/** The route file each namespace list mirrors, for the guard test's grep. */
export const NAMESPACE_SOURCES: Record<"sunMonth" | "cityPage", string> = {
  sunMonth: "app/[locale]/[cityPrefix]/[city]/[month]/page.tsx",
  cityPage: "app/[locale]/[cityPrefix]/[city]/page.tsx",
};

/**
 * 64 bits per part, hex. Not a security boundary — nobody is trying to forge a
 * sitemap date — so the length is chosen for a failure message a human reads
 * and retypes. A collision would have to be engineered on purpose.
 */
function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex").slice(0, 16);
}

/**
 * Deterministic serialization: object keys sorted, arrays left in order (order
 * is content — it is the order of the day-by-day table and of the nearby-city
 * links). `undefined` is dropped so an optional field that was never set reads
 * the same as an absent one.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

type Messages = Record<string, unknown>;

function readMessages(locale: string): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function copyParts(namespaces: readonly string[]): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const locale of routing.locales) {
    const messages = readMessages(locale);
    // A missing namespace hashes as `null` rather than throwing: next-intl does
    // not throw on a missing message either (it renders the key path into the
    // HTML), so a namespace disappearing from one locale is a content change
    // this guard should report, not a crash.
    parts[`copy.${locale}`] = hash(
      Object.fromEntries(namespaces.map((ns) => [ns, messages[ns] ?? null])),
    );
  }
  return parts;
}

/** Identity and geometry, in the order the family's generator iterates. */
function cityShape(city: City, base: string): unknown {
  return {
    base,
    lat: city.lat,
    lon: city.lon,
    tz: city.tz,
    timezone: city.timezone,
    elevation: city.elevation ?? 0,
    names: Object.fromEntries(routing.locales.map((l) => [l, localizedCityName(l, base)])),
  };
}

function cityByBase(base: string): City {
  const city = BUILTIN_CITIES.find((c) => baseSlug(c.id) === base);
  // A base slug with no city is a bug in SUNRISE_CITIES, and it would silently
  // shrink the hashed set — the one failure this module must not paper over.
  if (!city) throw new Error(`content-fingerprint: no builtin city for "${base}"`);
  return city;
}

const t2 = (h: number | null) => (h !== null ? fmtTime(h) : "—");
const len = (min: number | null) => (min !== null ? fmtDayLength(min) : "—");

/**
 * The month pages' printed numbers, for every configured city and all twelve
 * months — not a sample. Everything is put through the page's own formatters
 * first, so the digest is over the strings a reader sees. That is also what
 * makes it reproducible: `Math.sin` is not guaranteed identical to the last bit
 * across V8 versions, and rounding to the printed minute is exactly the
 * precision the pages claim.
 */
function sunMonthFigures(): unknown {
  return SUNRISE_CITIES.map((base) => {
    const city = cityByBase(base);
    return {
      base,
      months: Array.from({ length: 12 }, (_, monthIndex) => {
        const d = monthData(
          city.lat, city.lon, city.tz, city.timezone, city.elevation ?? 0, monthIndex,
        );
        return {
          deltaMin: d.deltaMin,
          days: d.days.map((day) => ({
            day: day.day,
            dawn: t2(day.civilDawn),
            sunrise: t2(day.sunrise),
            sunset: t2(day.sunset),
            dusk: t2(day.civilDusk),
            polar: day.polar,
            length: len(d.dayLen(day)),
          })),
          mid: {
            sunrise: t2(d.mid.sunrise),
            sunset: t2(d.mid.sunset),
            golden: t2(d.mid.goldenEveningStart),
            length: len(d.dayLen(d.mid)),
          },
          window: d.exposure
            ? {
                start: t2(d.exposure.windowStart),
                end: t2(d.exposure.windowEnd),
                minutes: Math.round(d.exposure.minutesNeeded),
              }
            : null,
          direction: d.direction,
          /**
           * The phase-2 prose paragraph, which prints figures of its own — a
           * window, a peak elevation, a minutes-in-the-sun number — computed by
           * lib/sun-prose.ts and NOT derivable from `monthData` above. Without
           * this, changing an assumption inside that module (its skin type, its
           * exposed fraction, its 1000 IU target) would silently rewrite the
           * paragraph on every treated city's twelve pages in all six locales
           * while this fingerprint, and therefore the sitemap's lastmod, swore
           * nothing had changed.
           *
           * Gated on `isTreated` because that is exactly the page's own
           * condition, so the hash covers what is rendered and nothing else.
           * Which cities are treated is covered separately, by
           * `constants.phase2Treated` — flip one and the membership moves the
           * hash even before the figures do.
           */
          prose: isTreated(base) ? sunProse(city, monthIndex) : null,
        };
      }),
    };
  });
}

/**
 * The city pages' printed numbers, for all 73 builtin cities: the year profile
 * that drives the verdict copy and the year strip, the four representative
 * windows, and the mid-month table.
 *
 * `hoursByDay` is 365 floats per city, so it is rounded to a tenth of an hour —
 * both because that is finer than anything the strip draws and because hashing
 * raw trig output would make the digest sensitive to a last-bit difference
 * between V8 versions.
 */
function cityPageFigures(): unknown {
  return BUILTIN_CITIES.map((city) => {
    const profile = cityYearProfile(city.lat, city.lon, city.elevation ?? 0);
    return {
      base: baseSlug(city.id),
      profile: {
        possibleMonths: profile.possibleMonths,
        impossibleMonths: profile.impossibleMonths,
        allYear: profile.allYear,
        neverPossible: profile.neverPossible,
        hoursByDay: profile.hoursByDay.map((h) => Number(h.toFixed(1))),
      },
      windows: citySeasonalWindows(city.lat, city.lon, city.tz, city.elevation ?? 0).map((w) => ({
        doy: w.doy,
        monthIndex: w.monthIndex,
        possible: w.possible,
        start: t2(w.windowStart),
        end: t2(w.windowEnd),
        minutes: w.minutesNeeded === null ? null : Math.round(w.minutesNeeded),
      })),
      months: monthlySunTimes(city.lat, city.lon, city.timezone, city.tz).map((m) => ({
        monthIndex: m.monthIndex,
        sunrise: t2(m.sunrise),
        sunset: t2(m.sunset),
        length: len(m.dayLengthMin),
        polar: m.polar,
      })),
    };
  });
}

/**
 * The month-page family's parts map: 2880 URLs at
 * `/{sunPrefix}/{city}/{month}`.
 */
export function sunMonthParts(): Record<string, string> {
  return {
    ...copyParts(SUN_MONTH_NAMESPACES),
    cities: hash(SUNRISE_CITIES.map((base) => cityShape(cityByBase(base), base))),
    figures: hash(sunMonthFigures()),
    constants: hash({
      doyReferenceYear: DOY_REFERENCE_YEAR,
      // Which cities render the phase-2 prose paragraph. Flipping one changes
      // twelve pages ×6 locales without touching a single message string.
      phase2Treated: SUNRISE_CITIES.filter((base) => isTreated(base)),
    }),
  };
}

/** The city-page family's parts map: 438 URLs at `/{cityPrefix}/{city}`. */
export function cityPageParts(): Record<string, string> {
  return {
    ...copyParts(CITY_PAGE_NAMESPACES),
    cities: hash(BUILTIN_CITIES.map((city) => cityShape(city, baseSlug(city.id)))),
    figures: hash(cityPageFigures()),
    constants: hash({ doyReferenceYear: DOY_REFERENCE_YEAR }),
  };
}
