import { routing } from "./routing";
import { getPathname } from "./navigation";
import { SITE_URL } from "@/lib/site";

/**
 * Builds the `alternates` metadata block for a page: a self-referencing
 * canonical (the current locale's URL), hreflang entries for all locales, and
 * an x-default pointing at the default-locale (es, prefix-free) version of the
 * SAME page — so hreflang reciprocity holds (validators flag x-default → "/"
 * on non-home pages).
 *
 * `pathname` is the locale-agnostic path, e.g. "/" or "/learn".
 */
export function buildAlternates(
  locale: string,
  pathname: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${SITE_URL}${getPathname({ href: pathname, locale: l })}`;
  }
  languages["x-default"] = `${SITE_URL}${getPathname({ href: pathname, locale: routing.defaultLocale })}`;

  return {
    canonical: `${SITE_URL}${getPathname({ href: pathname, locale: locale as (typeof routing.locales)[number] })}`,
    languages,
  };
}
