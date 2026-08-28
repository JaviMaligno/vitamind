import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { buildLanguageAlternates } from "@/i18n/metadata";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug, cityUrl, buildCityAlternates } from "@/lib/city-routes";
import {
  SUNRISE_CITIES, sunUrl, buildSunAlternates, sunCityUrl, buildSunCityAlternates,
} from "@/lib/sun-routes";
import {
  BANDS, buildSuntimeAlternates, buildSuntimeBandAlternates, suntimeUrl, suntimeBandUrl,
} from "@/lib/suntime-routes";
import {
  SUN_MONTH_REVISION, CITY_PAGE_REVISION, SUNTIME_PAGE_REVISION,
} from "@/lib/content-revision";

const PAGES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/explore", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/dashboard", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/learn", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/connect", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/profile", changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/partners", changeFrequency: "monthly" as const, priority: 0.6 },
  // The page the schema Person node points at. Low churn, but it has to be
  // discoverable: an identity anchor nothing crawls anchors nothing.
  { path: "/about", changeFrequency: "yearly" as const, priority: 0.5 },
  { path: "/methodology", changeFrequency: "monthly" as const, priority: 0.6 },
];

/**
 * WHY THE ON-DEMAND CITY PAGES ARE DELIBERATELY ABSENT. `/{cityPrefix}/{slug}`
 * also serves any city in the `cities` table (230,407 rows on 2026-08-26), which
 * is 1,382,442 URLs across six locales. They are `noindex, follow` by design
 * (D-15) — the `vitamina-d` template earns 35 impressions and 0 clicks in 28 days
 * with 438 URLs, so multiplying it by three thousand is thin content on a domain
 * with 19 inbound links. Listing them here would be a crawl request billed to the
 * read meter for pages that cannot rank. `app/__tests__/sitemap.test.ts` pins
 * their absence, and `lib/__tests__/indexnow.test.ts` pins that they never reach
 * a submission — because this function is what that script imports.
 */

/**
 * LASTMOD POLICY. Read this before adding an entry family.
 *
 * `lastmod` is not decoration: it is the field Google, Bing, Yandex, Seznam and
 * Naver schedule crawls from, and on this plan the read meter is
 * (URLs crawled) × (bytes served) — the meter that is currently at 95% of a
 * 1,000,000-unit allowance. So a false `lastmod` is not untidiness, it is a
 * request to re-crawl, priced.
 *
 * This function used to open with `const now = new Date()` and stamp it on all
 * 3612 entries. Since `/sitemap.xml` is statically prerendered, `now` was the
 * BUILD instant, so every deploy — a CI tweak, a README fix — announced that
 * every URL on the site had changed. The file contradicted itself while doing
 * it: it marks the 2880 month pages `yearly` and the 438 city pages `monthly`,
 * then re-dated all of them on a commit that touched neither.
 *
 * Each family now publishes what is actually true of it:
 *
 * | family                    | URLs | lastmod                          |
 * |---------------------------|------|----------------------------------|
 * | app pages (`PAGES`)       |   54 | render day (= build day)         |
 * | city pages                |  438 | `CITY_PAGE_REVISION.date`        |
 * | today hubs                |  240 | render day (= build day)         |
 * | month pages               | 2880 | `SUN_MONTH_REVISION.date`        |
 *
 * so a deploy re-dates 294 URLs instead of 3612, and `app/__tests__/sitemap.test.ts`
 * pins that number.
 *
 * Dates are emitted date-only (`YYYY-MM-DD`, valid per sitemaps.org). The old
 * value carried milliseconds — `2026-08-21T23:40:09.563Z` on 3612 lines — a
 * precision no one has about when a page's content changed.
 *
 * WHY THE TWO FROZEN FAMILIES ARE SAFE TO FREEZE, and what pays for it: their
 * declared date is guarded by a content hash. `lib/content-fingerprint.ts`
 * hashes the copy, the city list, the printed figures and the reference year,
 * and `lib/__tests__/content-revision.test.ts` fails when that moves without the
 * declared date moving with it. Without that guard, freezing these dates would
 * mean a corrected number shipping to 2880 pages announced as unchanged — the
 * failure mode CLAUDE.md tabulates five instances of.
 *
 * WHY THE HUBS ARE NOT FROZEN: their subject is today. `lib/sun-today.ts` and
 * `/api/revalidate-today` exist to keep them true day by day, so pinning them to
 * a hand-declared revision would be the one outright lie in the table above.
 *
 * WHAT "RENDER DAY" DOES NOT GIVE THE HUBS, and the one-line fix if it matters:
 * this route is static, so the hub date advances on deploy, not daily. Between
 * deploys it UNDERSTATES their freshness — the cron regenerates the hub every
 * morning while the sitemap keeps saying "unchanged since the build". Understated
 * is the direction that costs reads rather than credibility, which is why it is
 * the default here.
 *
 * To make it daily you would add `revalidatePath("/sitemap.xml")` to the loop in
 * `app/api/revalidate-today/route.ts` (its test asserts the exact call count, so
 * that assertion moves with it). TWO CORRECTIONS TO AN EARLIER VERSION OF THIS
 * PARAGRAPH, both of which change the decision rather than decorating it:
 *
 *   - It priced the regeneration at "on the order of 400 write units daily" by
 *     dividing a ~3.3 MB document by the 8 KB unit. Wrong unit: ISR writes are
 *     compressed, and this sitemap gzips to 53,576 bytes — about SEVEN units a
 *     day, not four hundred. The write cost is not the reason to defer.
 *   - The real reason to defer is the side effect that paragraph never
 *     mentioned. Regenerating this route re-runs `sitemap()`, and the 54 app
 *     pages take their date from the render day (see below), so a daily
 *     revalidation would silently start announcing all 54 as changed EVERY DAY
 *     — the exact `new Date()`-on-everything behaviour this file exists to stop,
 *     reintroduced through the back door on 1.5% of the sitemap. Anyone taking
 *     this option must give the app pages a declared date first.
 *
 * So: defer, but for the crawl it provokes and the app-page regression, not for
 * seven units. Revisit when the hubs are earning impressions.
 *
 * WHY THE APP PAGES KEEP THE BUILD DAY: there is no cheap fingerprint of "the
 * whole app", and these 54 URLs are 1.5% of the sitemap. Over-claiming on 1.5%
 * buys the guarantee that a hand-edited page — a `/learn` answer, the
 * `/methodology` copy — is always announced. A hand-bumped constant here would
 * make exactly those edits silent, which is the hazard this change is otherwise
 * spending its effort to close.
 *
 * TWO MORE REASONS, ADDED AFTER THE OBVIOUS IMPROVEMENT WAS COSTED AND DROPPED.
 * Giving these 54 a declared revision looks like the last loose end in this file.
 * It was investigated on 2026-08-22 and declined, for reasons that are not
 * visible from here:
 *
 *   1. IT WOULD SILENTLY BREAK A DEPENDENCY IN ANOTHER FILE. The `nav`,
 *      `notifications` and `install` namespaces are deliberately NOT hashed into
 *      `CITY_PAGE_REVISION` — read the header of lib/content-fingerprint.ts — and
 *      the stated reason is that they are shared with these app pages, "which
 *      keep a build-time lastmod, so a chrome edit is already announced there".
 *      That sentence is load-bearing on THIS policy. Declare a date here without
 *      hashing chrome into it and a SiteFooter or SiteNav copy edit becomes
 *      announced nowhere on the whole site.
 *   2. IT CANNOT COVER THE PAGES THAT MOVE ANYWAY. `/dashboard` is
 *      `changeFrequency: daily` and `/explore` is weekly because their content IS
 *      the current day's figures, computed in the browser. A frozen date on those
 *      is the same lie this file refuses for the hubs. So a declared revision
 *      could only cover the four genuinely static ones (`/learn`, `/connect`,
 *      `/about`, `/methodology`) — 24 of the 54 URLs — which halves the benefit
 *      while leaving all of the machinery, plus a new fingerprint family to keep
 *      honest.
 *
 * The measured prize was 24 URLs × ~28 deploys/month of false announcements
 * removed, worth something only if the engines act on lastmod at all. That is not
 * worth a fourth revision family. If it is ever revisited, item 1 is the
 * precondition: hash the chrome namespaces here FIRST, or into the city page,
 * before anything else changes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  /**
   * The day this artifact was rendered, UTC. Vercel builds in UTC; a local build
   * on a machine east or west of it can be off by a day, which is inside the
   * error bar of the claim being made.
   */
  const renderDay = new Date().toISOString().slice(0, 10);

  // The hand-maintained app pages: 54 URLs whose content is the app itself, so
  // the build day is their change event (see the header for why they are not
  // given a declared revision like the two programmatic families).
  const staticEntries = PAGES.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${getPathname({ href: path, locale })}`,
      lastModified: renderDay,
      changeFrequency,
      priority,
      alternates: { languages: buildLanguageAlternates(path) },
    })),
  );

  // 73 builtin cities × 6 locales. Slugs and prefixes are localized, so each
  // locale's URL is distinct and its alternates point at the same city elsewhere.
  // Declared date, guarded by the `cityPage` half of the content fingerprint.
  const cityEntries = BUILTIN_CITIES.flatMap((city) => {
    const base = baseSlug(city.id);
    return routing.locales.map((locale) => ({
      url: cityUrl(locale, base),
      lastModified: CITY_PAGE_REVISION.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: buildCityAlternates(locale, base).languages },
    }));
  });

  // The city hub at the sunrise prefix (`/amanecer/madrid`): starter batch × 6
  // locales. `daily` because its subject IS today — the twelve month pages below
  // are yearly astronomy, this one answers a question whose answer moves. Which
  // is also why it is the one programmatic family with a clock-derived date.
  const sunHubEntries = SUNRISE_CITIES.flatMap((base) =>
    routing.locales.map((locale) => ({
      url: sunCityUrl(locale, base),
      lastModified: renderDay,
      changeFrequency: "daily" as const,
      priority: 0.7,
      alternates: { languages: buildSunCityAlternates(locale, base).languages },
    })),
  );

  // Sunrise/sunset month pages: starter batch × 12 months × 6 locales. The
  // largest family and the one whose content moves least — a pure function of
  // (city, month, DOY_REFERENCE_YEAR), which is why the page itself is
  // `revalidate = false`. A build clock here was 2880 false claims per deploy.
  const sunEntries = SUNRISE_CITIES.flatMap((base) =>
    Array.from({ length: 12 }, (_, monthIndex) =>
      routing.locales.map((locale) => ({
        url: sunUrl(locale, base, monthIndex),
        lastModified: SUN_MONTH_REVISION.date,
        changeFrequency: "yearly" as const,
        priority: 0.6,
        alternates: { languages: buildSunAlternates(locale, base, monthIndex).languages },
      })),
    ).flat(),
  );

  // The 24 "how long in the sun" pages: one mother and three bands × 6 locales.
  // INDEXABLE, unlike the on-demand city pages, and that is the point of the
  // family — they answer the query shape that has demand and no page (spec §1).
  // Their own declared revision, not CITY_PAGE_REVISION: the two families move
  // on different events, and sharing a constant would re-date 462 URLs for a
  // change to 24. `monthly` rather than `yearly` because the copy is new and
  // expected to move while it is being tuned.
  const suntimeEntries = routing.locales.flatMap((locale) => [
    {
      url: suntimeUrl(locale),
      lastModified: SUNTIME_PAGE_REVISION.date,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      alternates: { languages: buildSuntimeAlternates(locale).languages },
    },
    ...BANDS.map((band) => ({
      url: suntimeBandUrl(locale, band),
      lastModified: SUNTIME_PAGE_REVISION.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: buildSuntimeBandAlternates(locale, band).languages },
    })),
  ]);

  return [
    ...staticEntries, ...cityEntries, ...sunHubEntries, ...sunEntries, ...suntimeEntries,
  ];
}
