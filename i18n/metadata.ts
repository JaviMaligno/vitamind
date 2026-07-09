import { routing } from "./routing";
import { getPathname } from "./navigation";
import { SITE_URL } from "@/lib/site";

/**
 * Builds the hreflang `languages` map for a page: one absolute URL per locale
 * plus an x-default pointing at the default-locale (es, prefix-free) version of
 * the SAME path, so hreflang reciprocity holds. Shared by page metadata
 * (`buildAlternates`) and the sitemap so the two never drift.
 *
 * `pathname` is the locale-agnostic path, e.g. "/" or "/learn".
 */
export function buildLanguageAlternates(pathname: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${SITE_URL}${getPathname({ href: pathname, locale: l })}`;
  }
  languages["x-default"] = `${SITE_URL}${getPathname({ href: pathname, locale: routing.defaultLocale })}`;
  return languages;
}

/**
 * Builds the `alternates` metadata block for a page: a self-referencing
 * canonical (the current locale's URL) plus the shared hreflang language map.
 */
export function buildAlternates(
  locale: string,
  pathname: string,
): { canonical: string; languages: Record<string, string> } {
  return {
    canonical: `${SITE_URL}${getPathname({ href: pathname, locale: locale as (typeof routing.locales)[number] })}`,
    languages: buildLanguageAlternates(pathname),
  };
}
