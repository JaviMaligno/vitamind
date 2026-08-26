/**
 * WHEN THE SITEMAP SAYS EACH PAGE FAMILY LAST CHANGED.
 *
 * `app/sitemap.ts` used to stamp `new Date()` on all 3612 entries, so every
 * deploy told Google, Bing, Yandex, Seznam and Naver that every URL on the site
 * had changed. It was false on its face — the same file marks the 2880 month
 * pages `yearly` and the 438 city pages `monthly` — and it is not a harmless
 * kind of false: `lastmod` is what the engines schedule crawls from, and on this
 * plan the read meter is URL count × served bytes. Re-dating 3612 URLs on every
 * unrelated commit is a request to re-crawl the whole site, billed to the meter
 * that is already at 95%.
 *
 * These two families are the ones whose content genuinely does not move with the
 * build clock, so they publish a DECLARED date instead of `now`:
 *
 * - the 2880 sunrise/sunset month pages (`/amanecer/madrid/agosto`), which are a
 *   pure function of (city, month, `DOY_REFERENCE_YEAR`) — see the `revalidate`
 *   comment on their page, which spells out that nothing on their render path
 *   reads a clock;
 * - the 438 vitamin D city pages (`/vitamina-d/madrid`), whose figures are the
 *   four representative days of the same reference year.
 *
 * The hub pages (`/amanecer/madrid`) are NOT here. Their subject is today, they
 * are revalidated daily by `/api/revalidate-today`, and a declared date would
 * freeze them; they keep a moving one. `lib/sun-today.ts` explains why their
 * content is the one thing on the site that must not be pinned.
 *
 * HOW TO EDIT THIS FILE. Do not edit it by hand from memory. Change the copy or
 * the code, run `npx vitest run lib/__tests__/content-revision.test.ts`, and
 * paste the block it prints — it contains both the new `parts` and today's date.
 * The guard exists because the alternative to it is the failure mode CLAUDE.md
 * already documents five times over: a corrected number that ships to thousands
 * of pages announced as unchanged, so the engines keep serving the wrong one.
 *
 * `parts` is not read at runtime. It is the recorded fingerprint the guard test
 * compares against, and it lives next to the date so that the two can only be
 * updated together.
 */

export interface ContentRevision {
  /**
   * `YYYY-MM-DD`, UTC. Date-only on purpose: our knowledge of when this content
   * changed is a commit, not an instant, and the old millisecond-precision
   * timestamp claimed a precision that did not exist. Date-only `lastmod` is
   * valid per sitemaps.org.
   */
  readonly date: string;
  /** Part name → 16 hex chars, from `lib/content-fingerprint.ts`. */
  readonly parts: Readonly<Record<string, string>>;
}

/**
 * THE TWO DATES BELOW ARE 2026-08-17, NOT THE DAY THE GUARD WAS WRITTEN
 * (2026-08-22). The fingerprints were recorded on the 22nd, but a `lastmod` is a
 * claim about the content, not about the tooling: `git log` over every hashed
 * input — `messages/*.json`, `lib/solar.ts`, `lib/sun-times.ts`,
 * `lib/sun-copy.ts`, `lib/sun-prose.ts`, `lib/cities.ts`, `lib/city-slugs.ts`,
 * `lib/city-content.ts`, `lib/uv-model.ts`, `lib/vitd.ts`, `lib/sun-routes.ts`,
 * `lib/phase2-cities.ts` — puts the last one at 2026-08-17 (e5d46d4, the
 * direction feature, which really did change what the month pages print).
 *
 * The city pages may in truth be a few days older than that: the 17th is the
 * last commit touching a file they depend on, not a proof that their own output
 * moved. Overstating by days errs toward an earlier re-crawl of pages that did
 * not change, which is the harmless direction and a rounding error next to the
 * `new Date()` this replaces.
 *
 * A worked example of the same distinction, since it is the one thing about this
 * file that is easy to get wrong. Both `figures` hashes were re-recorded on
 * 2026-08-22, twice in one day, and the date moved with NEITHER:
 *
 *   1. `lib/sun-prose.ts` was missing from the fingerprint. The list of hashed
 *      inputs above had always named it; the code did not hash it, leaving the
 *      phase-2 paragraph's printed figures on 1440 pages outside the guard.
 *   2. The `figures` part then stopped hashing computed numbers at all, because
 *      the digest was not reproducible across machines — see the long comment on
 *      SUN_MONTH_MODULES in lib/content-fingerprint.ts. It now hashes the source
 *      of the modules that compute those numbers.
 *
 * Neither was a change to one byte of what the pages say, so neither may move a
 * `lastmod`. The rule this illustrates: the date answers "when did the CONTENT
 * change", and fixing the instrument that watches the content is not the content
 * changing. Re-dating 3318 URLs to pay for a bug in a test is the crawl this
 * whole file exists to avoid.
 */

/** The 2880 month pages: `/{sunPrefix}/{city}/{month}` × 6 locales. */
export const SUN_MONTH_REVISION: ContentRevision = {
  date: "2026-08-26",
  parts: {
    "copy.es": "19c8154efe44dd27",
    "copy.en": "01d1084af16f6106",
    "copy.fr": "cba7554aea029b9d",
    "copy.de": "c5917fcf7f664286",
    "copy.ru": "7d0427fc5082438b",
    "copy.lt": "2fa9119bd4283f7d",
    cities: "35aebb84c49f350e",
    figures: "59a94b77e7c0efa1",
    constants: "a3b447afa17fa07c",
  },
};

/**
 * The 438 city pages: `/{cityPrefix}/{city}` × 6 locales.
 *
 * A third worked example of the distinction above, because it is the first one
 * where the hash moved for copy rather than for tooling and the date STILL did
 * not. On 2026-08-26 the honest-CTA work added `cityPage.viewNearestCityPage`
 * and `cityPage.viewIndexInstead`. `copyParts` hashes the `cityPage` namespace
 * whole, so all six `copy.*` moved — but these 438 pages do not render either
 * key. They belong to `components/CityPageLink.tsx`, the chip that lives on Mi
 * Día and Explorar, which are app pages with a moving `lastmod`. Not one byte of
 * what a city page prints changed, so `date` stays where it was.
 *
 * The native review of those keys later that day moved `fr`, `de`, `ru` and `lt`
 * again — German dropped a `{city}-Seite` compound that breaks on the four
 * multi-word city names, Lithuanian moved `{city}` out of a slot that wanted the
 * genitive, and French and Russian fixed a dangling quantifier and a number
 * disagreement. Same reasoning, same verdict: still not one byte of what a city
 * page prints.
 */
export const CITY_PAGE_REVISION: ContentRevision = {
  date: "2026-08-17",
  parts: {
    "copy.es": "c9d9516cdf41e807",
    "copy.en": "aacd37acffb61d09",
    "copy.fr": "3cebb7985b7cc2eb",
    "copy.de": "ef4e9ff3a53337e3",
    "copy.ru": "d0e786a4e57a05d0",
    "copy.lt": "e37baad848b76253",
    cities: "c66cfdadbf8dabad",
    figures: "41ccb7d4c32d4255",
    constants: "09032456232a5db5",
  },
};
