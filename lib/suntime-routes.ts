import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";

type Locale = (typeof routing.locales)[number];

/**
 * Localized routing for the "how long in the sun" pages: one mother per locale
 * (`/cuanto-sol-vitamina-d`) and three children under it
 * (`/cuanto-sol-vitamina-d/piel-clara`). Six locales × four pages = 24 URLs.
 *
 * They answer the query shape the site has no page for. Measured in Search
 * Console over three months, the 438 `/vitamina-d/{city}` pages take 39
 * impressions and 0 clicks at position 7.7 — the ranking is fine, the template
 * is wrong, because the queries with demand carry no city. See
 * docs/superpowers/specs/2026-08-27-fototipo-pages-design.md §1.
 *
 * WHY THE PREFIX IS NOT `vitamina-d`, and why the children cannot hang off it.
 * `i18n/on-demand-city-rewrite.ts` captures ANY two-segment path whose first
 * segment is that locale's `CITY_PREFIX` and sends it to the on-demand city
 * route, whatever the second segment looks like. So `/vitamina-d/piel-clara`
 * would be served as a city that does not exist. `SUNTIME_PREFIX` is disjoint
 * from `CITY_PREFIX` for every locale, and `app/__tests__/city-route-dynamic.test.ts`
 * pins that none of these 24 URLs is captured — generated from this module, so a
 * slug edit stays covered.
 *
 * WHY THE ROUTE FOLDERS ARE STATIC AND NOT `[suntimePrefix]`. Next allows one
 * slug name per position, and `app/[locale]/[cityPrefix]/` already holds that
 * one. These pages therefore get six static folders per level, exactly as the
 * sunrise hubs did for their own reason (see lib/sun-routes.ts), and a static
 * segment outranks a dynamic sibling so they are matched first.
 *
 * That also means each folder is matched for EVERY locale: `/en/cuanto-sol-vitamina-d`
 * reaches the Spanish folder with `locale = "en"`. `resolveSuntimePage` returns
 * null there, which is what keeps that URL a 404 instead of serving the English
 * page at a Spanish path — a duplicate whose canonical would point away from
 * itself.
 */

/* ------------------------------------------------------------------------- *
 * Slugs
 * ------------------------------------------------------------------------- */

/**
 * The mother's path prefix, per locale: the way the question is actually asked
 * in that language, not a translation of a label.
 *
 * ASCII throughout, like `CITY_PREFIX` and `SUN_PREFIX`, so Russian is
 * transliterated rather than encoded.
 */
export const SUNTIME_PREFIX: Record<string, string> = {
  es: "cuanto-sol-vitamina-d",
  en: "how-long-in-sun-vitamin-d",
  fr: "combien-de-soleil-vitamine-d",
  de: "wie-lange-sonne-vitamin-d",
  ru: "skolko-solnca-vitamin-d",
  lt: "kiek-saules-vitaminui-d",
};

/**
 * The three bands, by description and never by number.
 *
 * Fitzpatrick numerals appear as a gloss inside the page and never in a title
 * or a slug: the market converged on the descriptive grouping (Bask, Cancer
 * Council NSW and Healthline all group I-II / III-IV / V-VI), and self-reported
 * Fitzpatrick is unreliable, especially among people of colour (PubMed
 * 24928709). Six types stay as an input to the calculator; three bands are what
 * the content is written for. Spec §3.
 */
export const BANDS = ["fair", "medium", "dark"] as const;
export type Band = (typeof BANDS)[number];

/** Fitzpatrick types each band covers, for the in-page gloss. */
export const BAND_TYPES: Record<Band, [number, number]> = {
  fair: [1, 2],
  medium: [3, 4],
  dark: [5, 6],
};

/**
 * REVIEWED 2026-08-28, before the first deploy — which is the only moment these
 * can move cheaply. After a deploy a slug change costs a redirect and whatever
 * authority the old URL had accumulated.
 *
 * THE MIDDLE BAND WAS WRONG IN THREE OF SIX LANGUAGES, and always the same way:
 * "fair skin" and "dark skin" are real phrases in every language here, while
 * "medium skin" is not — it needs "tone". `mittlere-haut`, `srednyaya-kozha` and
 * `vidutine-oda` all parsed closer to "the middle skin" than to "medium skin
 * tone", so they became `mittlerer-hautton`, `sredniy-ton-kozhi` and
 * `vidutinio-tono-oda`.
 *
 * That leaves each language internally asymmetric — German pairs `helle-haut`
 * with `mittlerer-hautton` — and the asymmetry is deliberate. "helle Haut" and
 * "dunkle Haut" are what people actually type; forcing all three onto `-hautton`
 * for tidiness would trade the search term for the symmetry, and the search term
 * is the point.
 *
 * Russian took `sredniy-ton-kozhi` rather than the tempting `smuglaya-kozha`
 * (смуглая, tan/olive) because смуглая already carries the DARK band's title
 * ("при смуглой или тёмной коже"): two pages claiming one word.
 *
 * French needed nothing. `peau-mate` is precisely the French for olive or medium
 * skin, and `peau-claire` / `peau-foncee` are the ordinary terms.
 */
export const BAND_SLUGS: Record<string, Record<Band, string>> = {
  es: { fair: "piel-clara", medium: "piel-media", dark: "piel-oscura" },
  en: { fair: "fair-skin", medium: "medium-skin", dark: "dark-skin" },
  fr: { fair: "peau-claire", medium: "peau-mate", dark: "peau-foncee" },
  de: { fair: "helle-haut", medium: "mittlerer-hautton", dark: "dunkle-haut" },
  ru: { fair: "svetlaya-kozha", medium: "sredniy-ton-kozhi", dark: "temnaya-kozha" },
  lt: { fair: "sviesi-oda", medium: "vidutinio-tono-oda", dark: "tamsi-oda" },
};

/* ------------------------------------------------------------------------- *
 * Lookups
 * ------------------------------------------------------------------------- */

/**
 * The inverse of SUNTIME_PREFIX, for the twelve thin route folders.
 *
 * Each folder is named after one prefix and therefore serves one locale, so it
 * has to turn its own name back into that locale. Returns null rather than
 * guessing: a folder whose name is not in SUNTIME_PREFIX has no business
 * rendering anything, and the caller turns that into a loud build failure.
 *
 * Correct only while the prefixes are distinct across locales — which
 * `lib/__tests__/suntime-routes.test.ts` asserts, because two locales sharing a
 * prefix would make one of them unreachable. Note this is a stricter rule than
 * the city pages live under: `de` and `ru` share `vitamin-d` with `en` and get
 * away with it because their segment is dynamic and re-checked per locale.
 */
export function localeForSuntimePrefix(prefix: string): string | null {
  for (const [locale, value] of Object.entries(SUNTIME_PREFIX)) {
    if (value === prefix) return locale;
  }
  return null;
}

/** "piel-clara" → "fair", in this locale only. */
export function bandFromSlug(locale: string, slug: string): Band | null {
  const slugs = BAND_SLUGS[locale];
  if (!slugs) return null;
  for (const band of BANDS) if (slugs[band] === slug) return band;
  return null;
}

/* ------------------------------------------------------------------------- *
 * Paths, URLs and alternates
 * ------------------------------------------------------------------------- */

/** Locale-local path, no locale prefix: "/how-long-in-sun-vitamin-d". */
export function suntimePathname(locale: string): string {
  return `/${SUNTIME_PREFIX[locale]}`;
}

/** Locale-local path for a child: "/how-long-in-sun-vitamin-d/fair-skin". */
export function suntimeBandPathname(locale: string, band: Band): string {
  return `/${SUNTIME_PREFIX[locale]}/${BAND_SLUGS[locale][band]}`;
}

export function suntimeUrl(locale: string): string {
  return `${SITE_URL}${getPathname({ href: suntimePathname(locale), locale: locale as Locale })}`;
}

export function suntimeBandUrl(locale: string, band: Band): string {
  return `${SITE_URL}${getPathname({ href: suntimeBandPathname(locale, band), locale: locale as Locale })}`;
}

export function buildSuntimeAlternates(locale: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = suntimeUrl(l);
  languages["x-default"] = suntimeUrl(routing.defaultLocale);
  return { canonical: suntimeUrl(locale), languages };
}

export function buildSuntimeBandAlternates(
  locale: string,
  band: Band,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = suntimeBandUrl(l, band);
  languages["x-default"] = suntimeBandUrl(routing.defaultLocale, band);
  return { canonical: suntimeBandUrl(locale, band), languages };
}

/* ------------------------------------------------------------------------- *
 * Resolution and static params
 * ------------------------------------------------------------------------- */

/**
 * Does (locale, prefix) name this locale's mother page? The prefix check is the
 * one that keeps `/en/cuanto-sol-vitamina-d` a 404 — see the header.
 */
export function resolveSuntimePage(locale: string, prefix: string): boolean {
  return prefix === SUNTIME_PREFIX[locale];
}

/** Resolves (locale, prefix, bandSlug) → the band, or null. */
export function resolveSuntimeBandPage(
  locale: string,
  prefix: string,
  bandSlug: string,
): Band | null {
  if (prefix !== SUNTIME_PREFIX[locale]) return null;
  return bandFromSlug(locale, bandSlug);
}

/** Every locale, for the mother's `generateStaticParams`. */
export function suntimeStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

/** locale × band, for a child folder's `generateStaticParams`. */
export function suntimeBandStaticParams(locale: string): { band: string }[] {
  return BANDS.map((band) => ({ band: BAND_SLUGS[locale][band] }));
}

/**
 * All 24 public paths, locale-local. The single source the middleware test and
 * the sitemap both walk, so a slug edit cannot leave either behind.
 */
export function allSuntimePathnames(): { locale: string; pathname: string }[] {
  return routing.locales.flatMap((locale) => [
    { locale, pathname: suntimePathname(locale) },
    ...BANDS.map((band) => ({ locale, pathname: suntimeBandPathname(locale, band) })),
  ]);
}
