import { routing } from "./routing";
import { CITY_PREFIX, cityIdFromSlug } from "@/lib/city-routes";
import { geonameIdFromAlias, isDynamicCitySlug } from "@/lib/city-dynamic-slug";

type Locale = (typeof routing.locales)[number];

/**
 * The static segment that separates the on-demand route tree from the curated
 * one. It is never typed by a human: it exists only as the target of the rewrite
 * below, and it has to line up with the folder at
 * `app/[locale]/{ON_DEMAND_SEGMENT}/[cityPrefix]/[city]/page.tsx`.
 * `app/__tests__/city-route-dynamic.test.ts` compares the two.
 */
export const ON_DEMAND_SEGMENT = "on-demand";

/**
 * WHICH ROUTE FILE ANSWERS `/{CITY_PREFIX[locale]}/{slug}` — the split, decided
 * here, in the middleware, before Next has matched anything.
 *
 * Two families want that URL shape. The 438 curated pages are prerendered and
 * cached forever (`revalidate = false`, the saving won on 2026-08-22). The
 * on-demand layer serves ~235,000 more from the `cities` table and must NOT
 * write to the full route cache on a miss.
 *
 * One file cannot be both. Measured on 2026-08-26 against Next 16.1.6 with a
 * real `next start` (the plan's Paso 4): a `notFound()` for a param that
 * `generateStaticParams` did not list IS written to the full route cache —
 * `x-nextjs-prerender: 1`, `Cache-Control: s-maxage=31536000`, 11 files and
 * 19,613 bytes on disk per junk URL, HIT on the second request. Dropping
 * `revalidate` does not stop it; `dynamicParams = false` does not stop it;
 * `await connection()` before the `notFound()` returns a 500
 * (`DYNAMIC_SERVER_USAGE`), not a 404. The only thing that stops the write is
 * `export const dynamic = "force-dynamic"`, and segment config is per FILE — in
 * the curated file it would take all 438 pages out of the prerender. The ISR
 * write quota closed the last 30-day window at 181% (362,730 of 200,000), so
 * this is not a theoretical byte.
 *
 * Hence: the URL the visitor sees never changes, and this function decides which
 * of the two files renders it. Rewriting (not redirecting) is what keeps the
 * public URL, the canonical and the hreflang set identical to what they would be
 * if a single file served both.
 *
 * THE WALL IS SAFE TO LEAN ON, and it is measured rather than assumed: of the
 * 194 distinct builtin slugs across the six locales, ZERO end in two letters
 * after a hyphen, and every on-demand slug does. `cityIdFromSlug` is still
 * consulted first, so the measurement is a nice-to-have and not the guarantee.
 *
 * Returns the internal path to rewrite to, or null to leave the request alone.
 */
export function onDemandCityRewrite(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const isLocale = (value: string): value is Locale =>
    (routing.locales as readonly string[]).includes(value);

  // The default locale carries no prefix ("as-needed"), so a path may or may not
  // open with a locale segment.
  const hasLocaleSegment = isLocale(segments[0]);
  const locale: Locale = hasLocaleSegment ? (segments[0] as Locale) : routing.defaultLocale;
  const rest = hasLocaleSegment ? segments.slice(1) : segments;

  // Exactly `{prefix}/{slug}`. The index (`/vitamina-d`), the sunrise hubs and
  // the month pages (`/amanecer/madrid/julio`) all fall out here, and so does
  // the rewrite's own output — its extra segment makes `rest.length` 3, which is
  // what keeps a middleware that re-runs on the rewritten path from looping.
  if (rest.length !== 2) return null;

  const [prefix, slug] = rest;

  // The prefix must be the one THIS locale uses. `/en/vitamina-d/toledo-es` has
  // to keep 404ing: rewriting it would publish every on-demand page at three
  // URLs per locale and undo the check the curated file has always done.
  if (prefix !== CITY_PREFIX[locale]) return null;

  // The curated namespace is consulted FIRST and always wins (D-12). A curated
  // URL taken over by the rewrite would lose its prerender, its indexability and
  // its hreflang — and those 438 pages carry essentially all the organic traffic.
  if (cityIdFromSlug(locale, slug)) return null;

  // The syntactic prefilter, plus the id alias. The alias does NOT match
  // `isDynamicCitySlug` (the regex demands a two-letter country segment at the
  // end) yet `resolveDynamicCity` accepts it, and it is the form the search chip
  // emits when all it holds is a geoname id. Routing by the prefilter alone
  // would send every chip click to the static file, and cache its 404.
  if (!isDynamicCitySlug(slug) && geonameIdFromAlias(slug) === null) return null;

  // The locale is spelled out even for `es`, whose public URL carries no prefix:
  // this rewrite bypasses next-intl, so nothing downstream can infer it.
  return `/${locale}/${ON_DEMAND_SEGMENT}/${prefix}/${slug}`;
}
