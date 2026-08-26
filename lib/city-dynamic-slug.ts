import { slugify } from "./city-slug";

/**
 * THE URL SHAPE OF THE ON-DEMAND CITY PAGES, and the one place it is decided.
 *
 * `/{CITY_PREFIX[locale]}/{slug}` with `slug = slugify(ascii_name)-{cc}`, plus
 * `-{geonameid}` when that pair is already taken. Only the prefix is localized;
 * the slug is NOT (D-12). For the long tail the GeoNames ASCII name is what
 * people type, localizing it would multiply by six a surface that is going
 * `noindex` anyway, and it removes a whole class of cross-locale collisions.
 *
 * QUALIFY ALWAYS, NOT ONLY ON COLLISION. If `toledo` were the URL while no
 * second Toledo existed, the URL would depend on a mutable dataset: the next
 * GeoNames release adds one and yesterday's URL has to move. Qualifying
 * unconditionally makes the slug a pure function of (name, country).
 *
 * DISJOINT FROM THE CURATED NAMESPACE, measured not assumed: of the 194 distinct
 * builtin slugs across the six locales, ZERO end in `-xx`. `SLUG_TO_ID`
 * (lib/city-routes.ts) is consulted FIRST and always wins.
 */
export function dynamicCitySlug(asciiName: string, cc: string, tiebreakId?: number): string {
  const base = `${slugify(asciiName)}-${cc.toLowerCase()}`;
  return tiebreakId === undefined ? base : `${base}-${tiebreakId}`;
}

/**
 * The syntactic prefilter, run BEFORE any database round trip. It throws away
 * most garbage for free, which matters because a miss may cost an ISR cache
 * write on a plan whose write quota is already exceeded (see the plan's Paso 4).
 */
const DYNAMIC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z]{2}(?:-\d+)?$/;

export function isDynamicCitySlug(slug: string): boolean {
  return DYNAMIC_SLUG_RE.test(slug);
}

/** `id-2519240` — the form a client that only holds a geoname id can build. */
export function aliasSlug(geonameId: number): string {
  return `id-${geonameId}`;
}

/** The geoname id inside an alias slug, or null when it is not one. */
export function geonameIdFromAlias(slug: string): number | null {
  const m = /^id-(\d+)$/.exec(slug);
  return m ? Number(m[1]) : null;
}
