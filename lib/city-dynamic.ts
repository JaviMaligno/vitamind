import { cache } from "react";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CITY_PREFIX } from "./city-prefix";
import { ccToFlag } from "./cc-flag";
import { isDynamicCitySlug, geonameIdFromAlias } from "./city-dynamic-slug";
import { SITE_URL } from "./site";
import { getSupabase } from "./supabase";
import { tzOffset } from "./cities-api";
import type { City } from "./types";

/**
 * ON-DEMAND CITY PAGES: resolving `/{CITY_PREFIX[locale]}/{slug}` for a city
 * that is NOT one of the 73 curated ones.
 *
 * WHY SUPABASE AND NOT public/cities15000.json (D-13). Not the weight — the data
 * quality. That file's `t` field is exactly round(lon/15) in all 33,390 records
 * without one exception: mean SOLAR time, not a civil zone. Madrid t=0 (really
 * +1), Istanbul t=2 (really +3), Reykjavik t=-1 (really 0); Kolkata (+5:30) and
 * Kathmandu (+5:45) both come out as 6. Publishing sunrise and sunset from that
 * would print a wrong hour in Madrid all 365 days, in HTML cached forever. The
 * `cities` table carries the IANA `timezone`, which `getSunTimes` and
 * `monthlySunTimes` already prefer over a fixed offset, DST included. It also
 * carries `elevation`, which the JSON does not have at all and without which
 * Bogota would print a sea-level headline.
 *
 * ONE QUERY PER PAGE, NOT PER VISIT: `cache()` shares the round trip between
 * `generateMetadata` and the page body within one render.
 */

export interface DynamicCity {
  city: City;
  /** The canonical slug, which may differ from the one asked for (id alias). */
  canonicalSlug: string;
  /** False when `city_names` had no entry for this locale — see Q-B(a). */
  nameIsLocalized: boolean;
}

/**
 * One row of `city_by_slug` / `city_by_geoname_id`, transcribed from their
 * `RETURNS TABLE` in supabase/migrations/20260826_city_slug_elevation.sql.
 *
 * Postgres declares every column of a RETURNS TABLE nullable, so the nullability
 * here is read off the underlying `cities` columns instead: `population` is
 * `INTEGER DEFAULT 0` (nullable), `elevation` and `slug` are the two nullable
 * columns the migration adds, and the rest are NOT NULL. `display_name` is
 * `COALESCE(cn.name, c.name)` over a NOT NULL `c.name`, so it never comes back
 * null even when the locale has no row in `city_names`.
 */
interface Row {
  geoname_id: number; name: string; ascii_name: string; country_code: string;
  lat: number; lon: number; population: number | null; timezone: string;
  elevation: number | null; slug: string | null; display_name: string;
}

async function query(slug: string, locale: string): Promise<Row | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const aliasId = geonameIdFromAlias(slug);
  const { data, error } = aliasId !== null
    ? await supabase.rpc("city_by_geoname_id", { p_geoname_id: aliasId, p_locale: locale })
    : await supabase.rpc("city_by_slug", { p_slug: slug, p_locale: locale });

  // A miss and a failure both resolve to "no page". Throwing here would turn a
  // transient database blip into a 500 on a page that is cached forever.
  if (error || !data || data.length === 0) return null;
  return data[0] as Row;
}

export const resolveDynamicCity = cache(
  async (locale: string, slug: string): Promise<DynamicCity | null> => {
    // The syntactic prefilter runs FIRST, so most garbage costs no round trip.
    if (!isDynamicCitySlug(slug) && geonameIdFromAlias(slug) === null) return null;

    const row = await query(slug, locale);
    // No slug, no page. `city_by_geoname_id` does not filter on `cities.slug`,
    // and that column is null until the re-seed fills it, so a row without one
    // would otherwise publish a canonical URL ending in `/null`.
    if (!row || !row.slug) return null;

    const city: City = {
      id: `geonames:${row.geoname_id}`,
      name: row.display_name || row.name,
      lat: row.lat,
      lon: row.lon,
      tz: tzOffset(row.timezone),
      timezone: row.timezone,
      // GeoNames has no `dem` for 0.2% of rows and the seed stores that as NULL
      // rather than as a claim about sea level. `undefined` keeps it a
      // non-claim: lib/city-content.ts then treats the city as it treats every
      // non-curated one today, at 0 m. A literal null would reach
      // `uvIndex(..., elevationM)` as a number and read as sea level anyway,
      // only without the type system knowing the value was never measured.
      elevation: row.elevation ?? undefined,
      country: row.country_code,
      flag: ccToFlag(row.country_code),
      population: row.population ?? undefined,
      slug: row.slug,
      source: "geonames",
    };

    return {
      city,
      canonicalSlug: row.slug,
      // True only when `city_names` supplied a name that DIFFERS from the
      // GeoNames one. A locale whose row happens to repeat the endonym (common
      // across the Latin-script locales) reports false, which is what the copy
      // needs: the procedence line answers "is this name the endonym?", not
      // "does a row exist?".
      nameIsLocalized: row.display_name !== row.name,
    };
  },
);

/** Locale-local path (no locale prefix): "/vitamin-d/toledo-es". */
export function dynamicCityPathname(locale: string, slug: string): string {
  return `/${CITY_PREFIX[locale] ?? CITY_PREFIX.es}/${slug}`;
}

/** Absolute URL including the locale prefix (es is prefix-free). */
export function dynamicCityUrl(locale: string, slug: string): string {
  return `${SITE_URL}${getPathname({
    href: dynamicCityPathname(locale, slug),
    locale: locale as (typeof routing.locales)[number],
  })}`;
}

/**
 * Self-referencing canonical + the six hreflang alternates, mirroring
 * `buildCityAlternates`. NEVER canonical to the nearest curated city: canonical
 * means "this is the same page", and Toledo is not Madrid (D-15). On a `noindex`
 * page hreflang is simply ignored, so it costs nothing — and the day a city is
 * promoted to curated, the reciprocity is already there.
 */
export function buildDynamicCityAlternates(
  locale: string,
  slug: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = dynamicCityUrl(l, slug);
  languages["x-default"] = dynamicCityUrl(routing.defaultLocale, slug);
  return { canonical: dynamicCityUrl(locale, slug), languages };
}
