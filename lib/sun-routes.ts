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
 * Starter batch (plan: grow in waves, not all 73×12 at once): the Spanish
 * cities plus high-traffic world cities across both hemispheres.
 */
export const SUNRISE_CITIES: string[] = [
  "madrid", "barcelona", "valencia", "sevilla", "malaga", "las-palmas", "tenerife",
  "londres", "paris", "berlin", "roma", "lisboa", "amsterdam", "dublin", "edimburgo",
  "nueva-york", "los-angeles", "miami", "chicago", "toronto",
  "ciudad-de-mexico", "bogota", "lima", "santiago", "buenos-aires",
  "sidney", "tokio", "singapur",
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
