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
 * - Nothing, any more, on the count this bullet used to make. It said the SOURCE
 *   TEXT of `lib/*.ts` was deliberately excluded, because comments here are long
 *   and rewritten constantly, so source hashing would demand a revision bump for
 *   edits that change nothing a reader sees — a guard that cries wolf gets bumped
 *   blindly, which is worse than no guard. That objection is real and it is now
 *   the accepted cost: `figures` hashes exactly that source text, because hashing
 *   the OUTPUT instead — which this bullet recommended — was not reproducible
 *   across machines and failed the deploy. See SUN_MONTH_MODULES below for the
 *   measurement and the reasoning.
 *
 *   Left in place rather than deleted, because the objection is the thing to
 *   remember: when this guard fires on a comment-only edit, that is not a bug,
 *   it is the price, and the answer is to re-record the hash WITHOUT moving the
 *   date (`lib/content-revision.ts` explains that distinction with two worked
 *   examples). Read the printed diff before pasting it — blind bumping is the
 *   failure this bullet correctly predicted.
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
 *   THIS EXCLUSION DEPENDS ON A POLICY IN ANOTHER FILE, so it cannot be read
 *   alone: it is only safe while the 54 app pages keep a moving lastmod. Give
 *   them a declared revision without hashing chrome into it and a SiteFooter or
 *   SiteNav copy edit becomes announced nowhere on the site. The same warning is
 *   written at the other end, in app/sitemap.ts's app-page policy, because a
 *   one-sided note is how this gets broken by someone reading only one file.
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
import { DOY_REFERENCE_YEAR } from "@/lib/solar";
import { isTreated } from "@/lib/phase2-cities";
import { REFERENCE, SEASON_MONTHS } from "@/lib/suntime-content";
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

/**
 * Message namespaces the four sun-time pages read
 * (`app/[locale]/_suntime/SuntimePage.tsx`). Exactly one: that component passes
 * nothing to a child that translates on its own, so the whole family's copy is
 * `suntimePage`.
 */
export const SUNTIME_NAMESPACES = ["suntimePage"] as const;

/** The route file each namespace list mirrors, for the guard test's grep. */
export const NAMESPACE_SOURCES: Record<"sunMonth" | "cityPage" | "suntime", string> = {
  sunMonth: "app/[locale]/[cityPrefix]/[city]/[month]/page.tsx",
  cityPage: "app/[locale]/[cityPrefix]/[city]/page.tsx",
  // The twelve route folders are thin; the component they all call is where the
  // namespace is actually read.
  suntime: "app/[locale]/_suntime/SuntimePage.tsx",
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

/**
 * THE MODULES THAT COMPUTE WHAT EACH FAMILY PRINTS.
 *
 * This part hashes SOURCE, not output, and the reason is a CI failure worth
 * recording rather than quietly working around.
 *
 * The first version ran the computation and hashed the numbers: every day's
 * sunrise, every window, every minute count, formatted exactly as the page
 * prints them. It was reproducible on one machine and NOT across two. The gate
 * caught it on the first push — every `copy.*`, `cities` and `constants` hash
 * matched between a laptop and Vercel's build container, and both families'
 * `figures` differed.
 *
 * The deleted version's own comment came within one sentence of this: it noted
 * that "`Math.sin` is not guaranteed identical to the last bit across V8
 * versions" and then concluded that rounding to the printed minute made the
 * digest reproducible. It does not. Rounding is not the fix, which is the part
 * that is easy to get wrong. `t2()`,
 * `Math.round()` and `toFixed(1)` do not remove the problem; they relocate it to
 * a knife edge. A day length landing on 07:12:29.9999 on one platform and
 * 07:12:30.0001 on another formats to a different minute, and across 40 cities ×
 * 12 months × 31 days plus 73 cities × 365 day-lengths, SOME value sitting
 * within 1e-12 of a boundary is not a risk, it is a certainty. A fingerprint
 * that changes when nothing changed is worse than none: it trains whoever meets
 * it to paste the new block without reading the diff, which is the exact reflex
 * this guard exists to prevent.
 *
 * So the question changes from "did the printed numbers move?" to "did anything
 * that DETERMINES them move?" — the model's code, plus the data and constants
 * already hashed in the parts beside this one. No float is ever hashed, so the
 * answer is identical on every machine.
 *
 * The cost, stated plainly: this is coarser. Reformatting a comment in
 * lib/solar.ts moves the hash and asks for a `lastmod` bump on pages whose
 * output did not change. That is the same direction of error this file already
 * accepts elsewhere — an early re-crawl of unchanged pages is cheap, a stale
 * page announced as unchanged is the failure CLAUDE.md documents five times.
 *
 * It also makes the code match its own documentation: the header of
 * lib/content-revision.ts has always described the hashed inputs as this list of
 * modules. It was the implementation that disagreed.
 */
const SUN_MONTH_MODULES = [
  "lib/solar.ts",
  "lib/sun-times.ts",
  "lib/sun-copy.ts",
  "lib/sun-prose.ts",
  "lib/uv-model.ts",
  "lib/vitd.ts",
  "lib/city-copy.ts",
] as const;

const CITY_PAGE_MODULES = [
  "lib/solar.ts",
  "lib/sun-times.ts",
  "lib/city-content.ts",
  "lib/city-copy.ts",
  "lib/uv-model.ts",
  "lib/vitd.ts",
] as const;

/**
 * The modules whose source decides every figure the sun-time pages print.
 *
 * `lib/suntime-routes.ts` is in the list and it is not obvious why: it holds
 * BAND_TYPES, which is what maps each page to the two Fitzpatrick types whose
 * minutes it quotes. Move a type from one band to another and three pages
 * change their numbers without a single message string moving.
 */
const SUNTIME_MODULES = [
  "lib/solar.ts",
  "lib/uv-model.ts",
  "lib/vitd.ts",
  "lib/suntime-content.ts",
  "lib/suntime-routes.ts",
  "lib/city-copy.ts",
  // The page component is here and its two siblings' are not, which is a
  // deliberate difference. This one CHOOSES which of the computed figures each
  // page prints — the mother quotes the six types at one instant, a band page
  // quotes its own seasonal span — so an edit here changes the numbers on all
  // 24 pages without touching a model file or a message string. That is exactly
  // what the guard is for. (The equivalent gap for the month pages, lib/schema.ts,
  // is documented as still open in lib/content-revision.ts; closing it there
  // would force a date decision on 3318 URLs in one commit, which is why this
  // family gets it and that one does not.)
  "app/[locale]/_suntime/SuntimePage.tsx",
] as const;

/**
 * Source of each module, keyed by path so a RENAME shows up too. Throws rather
 * than skipping a missing file: a module that has moved and is silently dropped
 * from the hash is a hole in the guard, and a red test is the cheap version of
 * that news.
 *
 * Line endings are normalised to LF before hashing, and that is not cosmetic.
 * The comment above claims the digest is "identical on every machine" because no
 * float is hashed. Floats were not the only way to break that: git's
 * `core.autocrlf` is on by default on Windows, so a Windows checkout holds these
 * modules in CRLF and Linux CI holds them in LF, and hashing the raw text made
 * `figures` differ between the two while every other part matched. The symptom
 * was a guard that could never go green on the maintainer's own machine — which
 * teaches exactly the paste-without-reading reflex the guard exists to prevent.
 * Normalising costs nothing on CI, where the files are already LF.
 */
function moduleSources(paths: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of paths) {
    out[path] = readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
  }
  return out;
}

/**
 * The month-page family's parts map: 2880 URLs at
 * `/{sunPrefix}/{city}/{month}`.
 */
export function sunMonthParts(): Record<string, string> {
  return {
    ...copyParts(SUN_MONTH_NAMESPACES),
    cities: hash(SUNRISE_CITIES.map((base) => cityShape(cityByBase(base), base))),
    figures: hash(moduleSources(SUN_MONTH_MODULES)),
    constants: hash({
      doyReferenceYear: DOY_REFERENCE_YEAR,
      // Which cities render the phase-2 prose paragraph. Flipping one changes
      // twelve pages ×6 locales without touching a single message string.
      phase2Treated: SUNRISE_CITIES.filter((base) => isTreated(base)),
    }),
  };
}

/**
 * The sun-time family's parts map: 24 URLs, one mother and three bands per
 * locale.
 *
 * No `cities` part, because these pages have no city — that absence IS the
 * point of the family (spec §1: the queries with demand carry no city). What
 * takes its place is `reference`: the latitude, exposed area, age and target
 * the pages quote. Those four are printed on every page as declared
 * assumptions, so changing one changes what all 24 say, and nothing else in
 * this map would notice.
 */
export function suntimeParts(): Record<string, string> {
  return {
    ...copyParts(SUNTIME_NAMESPACES),
    figures: hash(moduleSources(SUNTIME_MODULES)),
    reference: hash(REFERENCE),
    constants: hash({ doyReferenceYear: DOY_REFERENCE_YEAR, seasonMonths: SEASON_MONTHS }),
  };
}

/** The city-page family's parts map: 438 URLs at `/{cityPrefix}/{city}`. */
export function cityPageParts(): Record<string, string> {
  return {
    ...copyParts(CITY_PAGE_NAMESPACES),
    cities: hash(BUILTIN_CITIES.map((city) => cityShape(city, baseSlug(city.id)))),
    figures: hash(moduleSources(CITY_PAGE_MODULES)),
    constants: hash({ doyReferenceYear: DOY_REFERENCE_YEAR }),
  };
}
