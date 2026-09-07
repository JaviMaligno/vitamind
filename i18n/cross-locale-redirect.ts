import { routing } from "./routing";
import { getPathname } from "./navigation";
import { CITY_PREFIX, cityIdFromSlug, cityPathname, indexPathname } from "@/lib/city-routes";
import {
  SUN_PREFIX, SUNRISE_CITIES, monthIndexFromSlug, sunPathname, sunCityPathname,
} from "@/lib/sun-routes";
import {
  SUNTIME_PREFIX, bandFromSlug, suntimePathname, suntimeBandPathname, type Band,
} from "@/lib/suntime-routes";

type Locale = (typeof routing.locales)[number];

/**
 * Recovers city URLs whose locale segment does not match the rest of the path.
 *
 * Until 2026-07-10 the language switcher swapped only the locale segment and kept the
 * current language's prefix and slug, so switching `/lt/vitaminas-d/fyniksas` to German
 * produced `/de/vitaminas-d/fyniksas` — German locale, Lithuanian prefix, Lithuanian
 * slug — which 404s. The switcher now reads the page's hreflang links, so nothing
 * generates these any more, but Search Console still lists 118 of them and Google
 * re-crawls them periodically. Each one identifies its city unambiguously (the slug
 * belongs to exactly one city) and states its target locale, so each can be redirected
 * to the page it was always meant to reach.
 *
 * Three families are covered: city, sunrise (both the month page and the hub) and —
 * since 2026-08-28 — sun-time. The
 * last one is NOT legacy debris like the other two: it is what keeps the
 * unprefixed Spanish URL shareable at all. See suntimeTarget below.
 *
 * Returns null whenever the path is already correct, belongs to none of the three, or
 * cannot be resolved with certainty. Guessing would replace an honest 404 with a page
 * about the wrong city, which is the worse failure.
 */
export function crossLocaleRedirect(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const isLocale = (value: string): value is Locale =>
    (routing.locales as readonly string[]).includes(value);

  // The default locale carries no prefix in the URL ("as-needed"), so a path may or may
  // not open with a locale segment.
  const hasLocaleSegment = isLocale(segments[0]);
  const locale: Locale = hasLocaleSegment ? (segments[0] as Locale) : routing.defaultLocale;
  const rest = hasLocaleSegment ? segments.slice(1) : segments;
  if (rest.length === 0) return null;

  // A first segment that looks like a locale but is not one ("/df/...") is next-intl's
  // problem, not ours: rest would start with a prefix we would then "recover" into a
  // path the visitor never asked for.
  if (!hasLocaleSegment && looksLikeLocale(segments[0])) return null;

  const [prefix, ...tail] = rest;
  const target =
    cityTarget(locale, prefix, tail) ??
    sunTarget(locale, prefix, tail) ??
    suntimeTarget(locale, prefix, tail);
  if (!target) return null;

  const absolute = getPathname({ href: target, locale });
  return absolute === pathname ? null : absolute;
}

/** Two ASCII letters, i.e. the shape of a locale segment, whether or not we support it. */
function looksLikeLocale(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment);
}

function isKnownPrefix(prefix: string, table: Record<string, string>): boolean {
  return Object.values(table).includes(prefix);
}

/** The city id whose slug this is, in any locale. Slugs are unique across the set. */
function findCityId(slug: string): string | null {
  for (const candidate of routing.locales) {
    const id = cityIdFromSlug(candidate, slug);
    if (id) return id;
  }
  return null;
}

function findMonthIndex(slug: string): number | null {
  for (const candidate of routing.locales) {
    const index = monthIndexFromSlug(candidate, slug);
    if (index !== null) return index;
  }
  return null;
}

function cityTarget(locale: Locale, prefix: string, tail: string[]): string | null {
  if (!isKnownPrefix(prefix, CITY_PREFIX)) return null;
  if (tail.length > 1) return null;

  // The city index, e.g. "/fr/vitamin-d" → "/fr/vitamine-d".
  if (tail.length === 0) return indexPathname(locale);

  const cityId = findCityId(tail[0]);
  if (!cityId) return null;
  return cityPathname(locale, baseSlug(cityId));
}

/**
 * The sunrise family has two shapes, and for a year this function knew only one.
 *
 * The month page (`/amanecer/madrid/julio`) was covered from the start; the hub
 * (`/amanecer/madrid`, prefix + city, no month) was not, because it did not exist
 * yet as a route of its own. Search Console's 404 validation, started 2026-08-09,
 * failed on 2026-09-05 on exactly two URLs — `/lever-du-soleil/madrid` and
 * `/en/sonnenaufgang/madrid` — both hubs, while the other 88 answered 301 → 200.
 *
 * Both shapes now require the city to be in SUNRISE_CITIES. Only those 40 have
 * sunrise pages, so redirecting any other city replaced an honest 404 with a 301
 * that lands on one: `/de/sunrise/denver/june` → `/de/sonnenaufgang/denver/juni`
 * → 404, measured in production.
 */
function sunTarget(locale: Locale, prefix: string, tail: string[]): string | null {
  if (!isKnownPrefix(prefix, SUN_PREFIX)) return null;
  if (tail.length === 0 || tail.length > 2) return null;

  const cityId = findCityId(tail[0]);
  if (!cityId) return null;
  const base = baseSlug(cityId);
  if (!SUNRISE_CITIES.includes(base)) return null;

  if (tail.length === 1) return sunCityPathname(locale, base);

  const monthIndex = findMonthIndex(tail[1]);
  if (monthIndex === null) return null;

  return sunPathname(locale, base, monthIndex);
}

/**
 * The sun-time family, added 2026-08-28 after it broke in production the hour it
 * shipped.
 *
 * `localePrefix` is "as-needed" with `localeDetection` on, so a visitor whose
 * `Accept-Language` is not Spanish asking for `/cuanto-sol-vitamina-d` is sent
 * by the middleware to `/en/cuanto-sol-vitamina-d` — and that 404s by design,
 * because each of the twelve static folders serves exactly one locale. Measured
 * against production:
 *
 *   /vitamina-d/madrid      AL=en → 307 → /en/vitamina-d/madrid → /en/vitamin-d/madrid → 200
 *   /cuanto-sol-vitamina-d  AL=en → 307 → /en/cuanto-sol-vitamina-d → 404
 *
 * The city family survives that hop only because this file catches it. So this
 * is not a nicety for stale links: it is what makes the unprefixed Spanish URL
 * shareable at all. `curl` reported 200 and hid the whole thing, because with no
 * `Accept-Language` there is no redirect to follow.
 *
 * Unlike a city slug, a band slug is NOT unique across locales in principle, so
 * each candidate locale is tried and the first that resolves wins. In practice
 * the eighteen are distinct; the loop is what keeps that from being load-bearing.
 */
function suntimeTarget(locale: Locale, prefix: string, tail: string[]): string | null {
  if (!isKnownPrefix(prefix, SUNTIME_PREFIX)) return null;
  if (tail.length > 1) return null;

  // The mother, e.g. "/en/cuanto-sol-vitamina-d" → "/en/how-long-in-sun-vitamin-d".
  if (tail.length === 0) return suntimePathname(locale);

  const band = findBand(tail[0]);
  // No guess. Falling back to the mother would answer a question the visitor did
  // not ask, which is the failure this module's header refuses for cities too.
  if (!band) return null;
  return suntimeBandPathname(locale, band);
}

/** The band this slug names, in any locale. */
function findBand(slug: string): Band | null {
  for (const candidate of routing.locales) {
    const band = bandFromSlug(candidate, slug);
    if (band) return band;
  }
  return null;
}

/** "builtin:nueva-york" → "nueva-york". Local copy to keep this module's imports narrow. */
function baseSlug(cityId: string): string {
  return cityId.replace(/^builtin:/, "");
}
