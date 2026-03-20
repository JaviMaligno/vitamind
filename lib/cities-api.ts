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
}

/** Convert a 2-letter country code to a flag emoji using regional indicator symbols */
function ccToFlag(cc: string): string {
  if (!cc || cc.length !== 2) return "\u{1F4CD}";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => c.charCodeAt(0) + 0x1F1A5)
  );
}

/** Compute numeric UTC offset from an IANA timezone string */
function tzOffset(timezone: string): number {
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

/** Convert a Supabase city row to our City type */
function toCity(row: SupabaseCity): City {
  return {
    id: `geonames:${row.geoname_id}`,
    name: row.display_name ?? row.name,
    lat: row.lat,
    lon: row.lon,
    tz: tzOffset(row.timezone),
    country: row.country_code,
    flag: ccToFlag(row.country_code),
    population: row.population,
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
