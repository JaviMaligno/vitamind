import { routing } from "./routing";
import { getPathname } from "./navigation";
import { CITY_PREFIX, cityIdFromSlug, cityPathname, indexPathname } from "@/lib/city-routes";
import { SUN_PREFIX, monthIndexFromSlug, sunPathname } from "@/lib/sun-routes";

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
 * Returns null whenever the path is already correct, is not a city or sunrise URL, or
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
  const target = cityTarget(locale, prefix, tail) ?? sunTarget(locale, prefix, tail);
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

function sunTarget(locale: Locale, prefix: string, tail: string[]): string | null {
  if (!isKnownPrefix(prefix, SUN_PREFIX)) return null;
  if (tail.length !== 2) return null;

  const cityId = findCityId(tail[0]);
  if (!cityId) return null;

  const monthIndex = findMonthIndex(tail[1]);
  if (monthIndex === null) return null;

  return sunPathname(locale, baseSlug(cityId), monthIndex);
}

/** "builtin:nueva-york" → "nueva-york". Local copy to keep this module's imports narrow. */
function baseSlug(cityId: string): string {
  return cityId.replace(/^builtin:/, "");
}
