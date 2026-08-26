import { ccToFlag } from "./cc-flag";
import type { City } from "./types";

/** Raw row from the Supabase cities table (with optional localized name) */
interface SupabaseCity {
  geoname_id: number;
  name: string;
  ascii_name: string;
  country_code: string;
  lat: number;
  lon: number;
  population: number;
  timezone: string;
  display_name?: string;
  /**
   * Both added by 20260826_city_slug_elevation.sql, and both `| null` rather
   * than merely optional: the columns are NULLABLE and every RPC selects them,
   * so a row that exists but has not been re-seeded yet arrives as an explicit
   * `null`, not as an absent key. The optional half covers the other case — a
   * response produced before the migration reached the database.
   */
  elevation?: number | null;
  slug?: string | null;
}

/**
 * Compute numeric UTC offset from an IANA timezone string.
 *
 * Exported for lib/city-dynamic.ts: an on-demand city page resolves a row that
 * carries the IANA zone, and `City.tz` is the numeric offset the rest of the app
 * still reads. Same function, so a searched city and its page agree.
 */
export function tzOffset(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // tzPart looks like "GMT+2", "GMT-5:30", "GMT" etc.
    const match = tzPart.match(/GMT([+-]?\d+)?(?::(\d+))?/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? "0", 10);
    const minutes = parseInt(match[2] ?? "0", 10);
    return hours + (hours < 0 ? -minutes : minutes) / 60;
  } catch {
    return 0;
  }
}

/**
 * Convert a Supabase city row to our City type.
 *
 * Exported for lib/__tests__/cities-api-mapping.test.ts: this is the only place
 * a searched city acquires its elevation and its slug, and both are silent when
 * wrong — a missing elevation prints a plausible but incorrect month count, a
 * missing slug just yields a search result that cannot link anywhere.
 *
 * `?? undefined` on both, never the raw value: the columns are nullable, so
 * until the re-seed finishes every row carries `null`. `City.slug` is typed
 * `string | undefined`, and letting a null through would type-check all the way
 * to an href ending in `/null`. For elevation, undefined keeps "not measured"
 * (437 GeoNames rows have no `dem`) distinct from "at sea level" — consumers
 * default it to 0 themselves, which is how every non-curated city is treated
 * today anyway.
 */
export function toCity(row: SupabaseCity): City {
  return {
    id: `geonames:${row.geoname_id}`,
    name: row.display_name ?? row.name,
    lat: row.lat,
    lon: row.lon,
    tz: tzOffset(row.timezone),
    timezone: row.timezone,
    country: row.country_code,
    flag: ccToFlag(row.country_code),
    population: row.population,
    elevation: row.elevation ?? undefined,
    slug: row.slug ?? undefined,
    source: "geonames",
  };
}

/**
 * Search cities by name via the /api/cities endpoint.
 * Returns up to 10 results sorted by population.
 */
export async function searchCities(query: string, locale: string = "en"): Promise<City[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `/api/cities?q=${encodeURIComponent(query)}&limit=10&locale=${encodeURIComponent(locale)}`
    );
    if (!res.ok) return [];
    const rows: SupabaseCity[] = await res.json();
    return rows.map(toCity);
  } catch {
    return [];
  }
}

/**
 * Find the nearest city to a lat/lon coordinate.
 * Returns null if no city is found.
 */
export async function findNearestCityApi(
  lat: number,
  lon: number,
  locale: string = "en"
): Promise<City | null> {
  try {
    const res = await fetch(
      `/api/cities?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&limit=1&locale=${encodeURIComponent(locale)}`
    );
    if (!res.ok) return null;
    const rows: SupabaseCity[] = await res.json();
    if (!rows || rows.length === 0) return null;
    return toCity(rows[0]);
  } catch {
    return null;
  }
}
