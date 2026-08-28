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

/**
 * The 2880 month pages: `/{sunPrefix}/{city}/{month}` × 6 locales.
 *
 * A fourth worked example, and the first where the answer went the other way for
 * a reason worth writing down rather than because nothing changed.
 *
 * On 2026-08-27 `lib/schema.ts` stopped probing the timezone offset at the day's
 * start and started probing it at each event's own instant. On the two DST
 * transition days a year those two disagree, and `sunEvent` had been dropping
 * both Event nodes rather than publish an offset the zone does not hold. It now
 * labels them correctly, so 36 of these 2880 pages — the 6 city-months where a
 * transition lands on the first or last day, times six locales — gained two
 * Event nodes each. That IS a change to what those pages publish. `date` still
 * did not move, and the arithmetic is the whole argument:
 *
 *   - 36 pages changed. 2844 did not.
 *   - `date` is one number for the family, so moving it tells the engines that
 *     2844 unchanged URLs changed today. This file's own opening paragraph calls
 *     that "false on its face" and names the meter it is billed to; the read
 *     budget is crawled URLs, and it sits at 95% of a rolling 200 K.
 *   - Nothing a READER sees moved. The five failures CLAUDE.md documents are all
 *     a wrong figure served to a person under a `lastmod` that says it is
 *     current. This is absent machine-readable markup becoming present, on 1.25%
 *     of the family, and the engines re-crawl these on their own schedule
 *     regardless — `lastmod` is a hint, not a queue.
 *
 * The cost of the call, stated so it can be overturned knowingly: those 36 pages
 * carry their new Events under an older date, so Google may take its own time to
 * see them. The next real copy change to this family moves `date` and they ride
 * along. If the Event parity signal turns out to be worth buying sooner than
 * that, bumping the date is the way to buy it — deliberately, not by reflex.
 *
 * A GAP THIS EXPOSED, left open on purpose. `lib/schema.ts` is in neither module
 * list in `lib/content-fingerprint.ts`, so the guard did not fire at all here;
 * the reasoning above is a decision someone made, not one the test forced. Every
 * future change to the JSON-LD these pages carry is outside the guard the same
 * way. Adding it would move `figures` for BOTH families at once and force a date
 * decision on 3318 URLs in the same commit, which is why it is not done here.
 *
 * 2026-08-28 — `figures` RE-RECORDED IN ALL THREE FAMILIES, NO DATE MOVED.
 * `fmtDate` in `lib/solar.ts` stopped formatting month names from a hardcoded
 * Spanish array and now takes a locale. `lib/solar.ts` is in all three module
 * lists, so all three `figures` hashes moved together; nothing else did.
 *
 * None of the three families renders `fmtDate`. Grepped across the repo, it has
 * exactly two call sites: the `GlobalHeatmap` tooltip and the `/explore` date
 * label — and `GlobalHeatmap` reaches the page only through `VisualizationZone`,
 * which `/explore` alone imports. So the 2880 month pages, the 438 city pages
 * and the 24 sun-time pages do not print a single byte that this change touches.
 * `/explore` is an app page and keeps a build `lastmod` regardless.
 *
 * That is the file's own rule applied, not an exception to it: `date` answers
 * "when did the CONTENT change", and re-recording a hash because a *shared
 * module* moved is not a content change for pages that do not call the moved
 * function. Moving it would announce 3342 URLs as changed for a change none of
 * them render, on a read meter that closed its last window at 95%.
 */
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
    figures: "905e7c92287f25c8",
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
 *
 * All six moved once more when `cityPage.dynamicProvenance` and
 * `cityPage.dynamicNameLatin` were added for the on-demand city pages. Those two
 * keys are rendered only by the on-demand branch — a `noindex` page that is not
 * in the sitemap and therefore has no `lastmod` to state — so once again the 438
 * prerendered pages print exactly what they printed before, and `date` stays.
 *
 * The pattern is now established enough to state as a rule: `copyParts` hashes
 * each namespace WHOLE, so ADDING a key to `cityPage` will always move all six
 * `copy.*`, whether or not any of the 438 pages renders it. Moving `date` for
 * one of these is the mistake, not skipping it. Move `date` only when the diff
 * touches a key these pages actually render.
 */
export const CITY_PAGE_REVISION: ContentRevision = {
  date: "2026-08-17",
  parts: {
    "copy.es": "34ca0e375247fe2a",
    "copy.en": "bca2707728053e22",
    "copy.fr": "8a027f7cb5044894",
    "copy.de": "b3e19fe375854bb1",
    "copy.ru": "39c852cd4713ae68",
    "copy.lt": "ff610006e37f9b63",
    cities: "c66cfdadbf8dabad",
    figures: "58f2d26c0312c6c5",
    constants: "09032456232a5db5",
  },
};

/**
 * The 24 sun-time pages: `/{suntimePrefix}` and `/{suntimePrefix}/{band}`,
 * × 6 locales.
 *
 * A third family rather than a reuse of `CITY_PAGE_REVISION`, and the reason is
 * that the two move on different events. The city pages re-date when a city's
 * shape or the sunrise copy changes; these re-date when the reference
 * assumptions, the band mapping or the model change. Sharing a constant would
 * mean every edit to either family announcing the other as changed — 462 URLs
 * re-crawled for a change to 24, on a read meter that closed its last window at
 * 95%.
 *
 * Born on 2026-08-28, which for once is genuinely the date the content first
 * existed rather than a date reconstructed from `git log`.
 *
 * `copy.de`, `copy.ru` and `figures` were re-recorded the same day after the
 * native review moved three band slugs and two German and Russian sentences.
 * The DATE did not move with them, and the rule is the file's own: it answers
 * "when did the content change", and this content has never been served — there
 * is no earlier version out there for a `lastmod` to be wrong about.
 */
export const SUNTIME_PAGE_REVISION: ContentRevision = {
  date: "2026-08-28",
  parts: {
    "copy.es": "bf6f40fd1d24c0b2",
    "copy.en": "d5f4b1289d428a07",
    "copy.fr": "567bd4f9f1f82632",
    "copy.de": "a289462081a87c96",
    "copy.ru": "f14b45c7849f2daa",
    "copy.lt": "e61ab0b4db5bf4f9",
    figures: "9bbaaf909851e513",
    reference: "4303d27a87c4a0dd",
    constants: "c9d5d03dc2b9c7b9",
  },
};
