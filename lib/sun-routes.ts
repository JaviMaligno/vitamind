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
 * lib/city-routes.ts. The URL shares the [cityPrefix] dynamic segment with the
 * city pages (Next requires one slug name per position); each page validates
 * its own prefix, so the two trees can't collide.
 */

export const SUN_PREFIX: Record<string, string> = {
  es: "amanecer",
  en: "sunrise",
  fr: "lever-du-soleil",
  de: "sonnenaufgang",
  ru: "voskhod",
  lt: "sauletekis",
};

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
 * The hub occupies the same `[cityPrefix]/[city]` segment as the vitamin D city
 * pages, which validate `CITY_PREFIX` and bail out otherwise. The two families
 * therefore share one route file and are told apart by the prefix alone — so
 * this resolver must reject `CITY_PREFIX` as firmly as it rejects nonsense, or
 * one of the two page trees disappears.
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

/** locale × starter city, for generateStaticParams. */
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
