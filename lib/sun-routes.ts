import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { BUILTIN_CITIES } from "./cities";
import { baseSlug, cityIdFromSlug, localizedCitySlug } from "./city-routes";
import type { City } from "./types";

type Locale = (typeof routing.locales)[number];

/**
 * Localized routing for the programmatic sunrise/sunset pages
 * (`/amanecer/madrid/julio` ↔ `/en/sunrise/madrid/july`), mirroring
 * lib/city-routes.ts.
 *
 * The MONTH pages share the [cityPrefix] dynamic segment with the vitamin D
 * city pages (Next requires one slug name per position), which is harmless
 * because both families are static: `resolveSunPage` accepts only
 * `SUN_PREFIX[locale]` and the city index accepts only `CITY_PREFIX[locale]`, so
 * the two trees cannot collide.
 *
 * The city HUBS (`/amanecer/madrid`, no month) used to share that segment too
 * and no longer do: they have six static route folders of their own, one per
 * prefix, because they are the only family here that needs a revalidate
 * interval. See app/[locale]/_sun-hub/hub-route.tsx.
 */

export const SUN_PREFIX: Record<string, string> = {
  es: "amanecer",
  en: "sunrise",
  fr: "lever-du-soleil",
  de: "sonnenaufgang",
  ru: "voskhod",
  lt: "sauletekis",
};

/**
 * The inverse of SUN_PREFIX, for the six thin hub route folders.
 *
 * Each of `app/[locale]/amanecer/[city]/`, `.../sunrise/[city]/` and friends is
 * named after one prefix and therefore serves exactly one locale, so it needs to
 * turn its own folder name back into that locale to know which cities to
 * prerender. Returns null rather than guessing: a folder whose name is not in
 * SUN_PREFIX has no cities and no business rendering a hub, and the caller in
 * `app/[locale]/_sun-hub/hub-route.tsx` turns that into a loud build failure.
 *
 * Correct only while the prefixes are distinct across locales, which
 * app/__tests__/sun-hub-split.test.ts asserts — two locales sharing a prefix
 * would make one of them unreachable, since the folder can only resolve to one.
 */
export function localeForSunPrefix(prefix: string): string | null {
  for (const [locale, value] of Object.entries(SUN_PREFIX)) {
    if (value === prefix) return locale;
  }
  return null;
}

/** ASCII month slugs per locale, index 0 = January. */
export const MONTH_SLUGS: Record<string, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
  fr: ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"],
  de: ["januar", "februar", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"],
  ru: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"],
  lt: ["sausis", "vasaris", "kovas", "balandis", "geguze", "birzelis", "liepa", "rugpjutis", "rugsejis", "spalis", "lapkritis", "gruodis"],
};

/**
 * Grown in waves, not all 73×12 at once, so each wave can be measured before the
 * next one is added.
 *
 * Wave 1 (2026-07-19): the Spanish cities plus high-traffic world cities across both
 * hemispheres. In its first 8 days it produced most of the site's search impressions —
 * 435 in 28 days against 39 in the previous 90 — and nine of the ten most-seen pages
 * were from this tree.
 *
 * Wave 2 (2026-07-28): chosen on two criteria drawn from that data rather than by
 * gut. First, **latitude ≥ 48°**: the further from the equator, the more the twelve
 * monthly tables actually differ, so each page answers a distinct question instead of
 * being a near-copy of its siblings — the same reason low-latitude cities (Bangkok,
 * Nairobi, Kuala Lumpur) are deliberately still absent. Second, **major destination**,
 * matching the profile of the cities already earning impressions (Tokyo, Paris,
 * Amsterdam, London, Sydney). The observed queries are dominated by sunset and "what
 * time does it get dark", which is exactly what a high-latitude city makes interesting.
 *
 * Tromsø belongs here on both counts and is missing for a reason: its English slug
 * resolves to "troms" (the ø is dropped rather than folded to o), which is a Norwegian
 * county, not the city. Adding it would ship 12 wrong URLs. Fixing the slug means
 * changing the already-live /en/vitamin-d/troms, so it needs its own change with a
 * redirect — see the note in docs/plans/2026-07-19-sunrise-seo-pages.md.
 */
export const SUNRISE_CITIES: string[] = [
  // Wave 1
  "madrid", "barcelona", "valencia", "sevilla", "malaga", "las-palmas", "tenerife",
  "londres", "paris", "berlin", "roma", "lisboa", "amsterdam", "dublin", "edimburgo",
  "nueva-york", "los-angeles", "miami", "chicago", "toronto",
  "ciudad-de-mexico", "bogota", "lima", "santiago", "buenos-aires",
  "sidney", "tokio", "singapur",
  // Wave 2 — Nordic and central-European capitals plus the Pacific Northwest
  "reikiavik", "oslo", "estocolmo", "helsinki", "copenhague",
  "varsovia", "praga", "viena", "budapest", "bruselas",
  "seattle", "vancouver",
];

export function monthIndexFromSlug(locale: string, slug: string): number | null {
  const i = (MONTH_SLUGS[locale] ?? []).indexOf(slug);
  return i === -1 ? null : i;
}

export function sunPathname(locale: string, base: string, monthIndex: number): string {
  return `/${SUN_PREFIX[locale]}/${localizedCitySlug(locale, base)}/${MONTH_SLUGS[locale][monthIndex]}`;
}

export function sunUrl(locale: string, base: string, monthIndex: number): string {
  return `${SITE_URL}${getPathname({ href: sunPathname(locale, base, monthIndex), locale: locale as Locale })}`;
}

export function buildSunAlternates(
  locale: string,
  base: string,
  monthIndex: number,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = sunUrl(l, base, monthIndex);
  languages["x-default"] = sunUrl(routing.defaultLocale, base, monthIndex);
  return { canonical: sunUrl(locale, base, monthIndex), languages };
}

/** locale × starter city × 12 months, for generateStaticParams. */
export function sunStaticParams(): { locale: string; cityPrefix: string; city: string; month: string }[] {
  return routing.locales.flatMap((locale) =>
    SUNRISE_CITIES.flatMap((base) =>
      MONTH_SLUGS[locale].map((month) => ({
        locale,
        cityPrefix: SUN_PREFIX[locale],
        city: localizedCitySlug(locale, base),
        month,
      })),
    ),
  );
}

/* ------------------------------------------------------------------------- *
 * The city hub: the sunrise prefix WITHOUT a month (`/amanecer/madrid`)
 * ------------------------------------------------------------------------- */

/**
 * The hub has its own six static route folders (`app/[locale]/amanecer/[city]`
 * and friends), so `resolveSunCityPage` is now called with the folder's own
 * prefix as a literal rather than with whatever a dynamic segment captured.
 * The prefix check below is still load-bearing, and for a new reason: a static
 * folder is matched for EVERY locale, so `/en/amanecer/madrid` reaches the
 * Spanish folder's handler with `locale = "en"`. Returning null there is what
 * keeps that URL a 404 instead of serving the English hub at a Spanish path,
 * which would be a duplicate of `/en/sunrise/madrid` with a canonical pointing
 * away from itself.
 */

/** Locale-local path (no locale prefix): "/sunrise/london". */
export function sunCityPathname(locale: string, base: string): string {
  return `/${SUN_PREFIX[locale]}/${localizedCitySlug(locale, base)}`;
}

export function sunCityUrl(locale: string, base: string): string {
  return `${SITE_URL}${getPathname({ href: sunCityPathname(locale, base), locale: locale as Locale })}`;
}

export function buildSunCityAlternates(
  locale: string,
  base: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = sunCityUrl(l, base);
  languages["x-default"] = sunCityUrl(routing.defaultLocale, base);
  return { canonical: sunCityUrl(locale, base), languages };
}

/**
 * locale × starter city — the full set of 240 hubs, and the single source the
 * six route folders slice with `sunHubStaticParams`. It keeps the `cityPrefix`
 * key even though no route file has that segment any more, because that key IS
 * the slice criterion and because the existing tests in
 * lib/__tests__/sun-today.test.ts walk this list to prove every prerendered
 * triple resolves; deriving the folders from it means those tests still cover
 * exactly what gets built.
 */
export function sunCityStaticParams(): { locale: string; cityPrefix: string; city: string }[] {
  return routing.locales.flatMap((locale) =>
    SUNRISE_CITIES.map((base) => ({
      locale,
      cityPrefix: SUN_PREFIX[locale],
      city: localizedCitySlug(locale, base),
    })),
  );
}

/** Resolves (locale, prefix, citySlug) → the city, or null. */
export function resolveSunCityPage(
  locale: string,
  cityPrefix: string,
  citySlug: string,
): { city: City; base: string } | null {
  if (cityPrefix !== SUN_PREFIX[locale]) return null;
  const cityId = cityIdFromSlug(locale, citySlug);
  if (!cityId) return null;
  const base = baseSlug(cityId);
  if (!SUNRISE_CITIES.includes(base)) return null;
  const city = BUILTIN_CITIES.find((c) => c.id === cityId);
  return city ? { city, base } : null;
}

/** Resolves (locale, prefix, citySlug, monthSlug) → the city + month, or null. */
export function resolveSunPage(
  locale: string,
  cityPrefix: string,
  citySlug: string,
  monthSlug: string,
): { city: City; base: string; monthIndex: number } | null {
  if (cityPrefix !== SUN_PREFIX[locale]) return null;
  const monthIndex = monthIndexFromSlug(locale, monthSlug);
  if (monthIndex === null) return null;
  const cityId = cityIdFromSlug(locale, citySlug);
  if (!cityId) return null;
  const base = baseSlug(cityId);
  if (!SUNRISE_CITIES.includes(base)) return null;
  const city = BUILTIN_CITIES.find((c) => c.id === cityId);
  return city ? { city, base, monthIndex } : null;
}
