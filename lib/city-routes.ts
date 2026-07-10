import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { BUILTIN_CITIES } from "./cities";
import { slugify } from "./city-slug";
import { SITE_URL } from "./site";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

type Locale = (typeof routing.locales)[number];

const CITY_NAMES: Record<string, Record<string, string>> = {
  es: (es as { cities: Record<string, string> }).cities,
  en: (en as { cities: Record<string, string> }).cities,
  fr: (fr as { cities: Record<string, string> }).cities,
  de: (de as { cities: Record<string, string> }).cities,
  ru: (ru as { cities: Record<string, string> }).cities,
  lt: (lt as { cities: Record<string, string> }).cities,
};

/** Path prefix per locale — ASCII, keyword-bearing. */
export const CITY_PREFIX: Record<string, string> = {
  es: "vitamina-d",
  en: "vitamin-d",
  fr: "vitamine-d",
  de: "vitamin-d",
  ru: "vitamin-d",
  lt: "vitaminas-d",
};

/** "builtin:nueva-york" → "nueva-york" */
export function baseSlug(cityId: string): string {
  return cityId.replace(/^builtin:/, "");
}

/** The city's display name in `locale`, falling back to the base slug. */
export function localizedCityName(locale: string, base: string): string {
  return CITY_NAMES[locale]?.[base] ?? base;
}

/**
 * Locales whose names are written in a non-Latin script borrow another locale's
 * name for the URL slug. `ru` city names are Cyrillic renderings of names that
 * are already Latin ("Helsinki" → "Хельсинки"); transliterating them back would
 * double-transliterate into "khelsinki" / "tsyurikh" / "parizh". Only `Москва`
 * is Cyrillic-native, and "moscow" is a perfectly good slug for it.
 */
const LATIN_SLUG_LOCALE: Record<string, string> = { ru: "en" };

/**
 * ASCII slug of the city's name in `locale`. For non-Latin-script locales this
 * is the name borrowed from `LATIN_SLUG_LOCALE`. Falls back to transliterating
 * the locale's own name (which is what makes `slugify`'s Cyrillic map reachable
 * for a future city that has no `en` name), and finally to the base slug.
 */
export function localizedCitySlug(locale: string, base: string): string {
  const latinSource = LATIN_SLUG_LOCALE[locale] ?? locale;
  return (
    slugify(localizedCityName(latinSource, base)) ||
    slugify(localizedCityName(locale, base)) ||
    base
  );
}

// Reverse index, built once: locale → localized slug → cityId.
const SLUG_TO_ID: Record<string, Record<string, string>> = (() => {
  const index: Record<string, Record<string, string>> = {};
  for (const locale of routing.locales) {
    index[locale] = {};
    for (const city of BUILTIN_CITIES) {
      index[locale][localizedCitySlug(locale, baseSlug(city.id))] = city.id;
    }
  }
  return index;
})();

export function cityIdFromSlug(locale: string, slug: string): string | null {
  return SLUG_TO_ID[locale]?.[slug] ?? null;
}

/** Locale-local path (no locale prefix): "/vitamin-d/london" */
export function cityPathname(locale: string, base: string): string {
  return `/${CITY_PREFIX[locale]}/${localizedCitySlug(locale, base)}`;
}

/** Absolute URL including the locale prefix (es is prefix-free). */
export function cityUrl(locale: string, base: string): string {
  return `${SITE_URL}${getPathname({ href: cityPathname(locale, base), locale: locale as Locale })}`;
}

/**
 * Canonical (self-referencing) + hreflang alternates for a city, mirroring the
 * shape of `buildLanguageAlternates` in i18n/metadata.ts but with localized slugs.
 * x-default points at the default-locale (es) version of the same city.
 */
export function buildCityAlternates(
  locale: string,
  base: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = cityUrl(l, base);
  languages["x-default"] = cityUrl(routing.defaultLocale, base);
  return { canonical: cityUrl(locale, base), languages };
}

/** All 438 (locale, cityPrefix, city) combinations for generateStaticParams. */
export function cityStaticParams(): { locale: string; cityPrefix: string; city: string }[] {
  return routing.locales.flatMap((locale) =>
    BUILTIN_CITIES.map((c) => ({
      locale,
      cityPrefix: CITY_PREFIX[locale],
      city: localizedCitySlug(locale, baseSlug(c.id)),
    })),
  );
}
