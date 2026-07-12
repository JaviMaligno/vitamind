import { CITY_PREFIX } from "./city-prefix";

/**
 * Locale-local path of the city index (e.g. "/vitamin-d"). Client-safe: depends
 * only on the lean `CITY_PREFIX`, never on the message JSON, so it adds nothing
 * to the browser bundle. next-intl's `Link` adds the locale prefix.
 */
export function indexPath(locale: string): string {
  return `/${CITY_PREFIX[locale] ?? CITY_PREFIX.es}`;
}
