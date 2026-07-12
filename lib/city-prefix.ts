/**
 * The per-locale, ASCII, keyword-bearing path prefix for the city pages
 * (`/vitamina-d/madrid`, `/en/vitamin-d/london`, …).
 *
 * Kept in its own tiny module — with NO dependency on the message JSON — so a
 * client component can import it without pulling all six locale files into the
 * browser bundle. `lib/city-routes.ts` re-exports it for server-side callers.
 */
export const CITY_PREFIX: Record<string, string> = {
  es: "vitamina-d",
  en: "vitamin-d",
  fr: "vitamine-d",
  de: "vitamin-d",
  ru: "vitamin-d",
  lt: "vitaminas-d",
};
