import { routing } from "./routing";
import { getPathname } from "./navigation";

/**
 * Maps a legacy `?locale=xx` URL (from the old query-param i18n scheme, still
 * present in the previous sitemap) to the equivalent prefixed pathname.
 * Returns null when there is no supported `locale` param, so the caller can
 * fall through to the normal i18n middleware.
 */
export function legacyLocaleRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  const requested = searchParams.get("locale");
  if (!requested) return null;
  if (!routing.locales.includes(requested as (typeof routing.locales)[number])) {
    return null;
  }
  return getPathname({
    href: pathname || "/",
    locale: requested as (typeof routing.locales)[number],
  });
}
