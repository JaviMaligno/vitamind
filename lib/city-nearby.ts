import { BUILTIN_CITIES } from "./cities";
import { haversineKm } from "./geo-distance";
import type { City } from "./types";

/**
 * The `n` builtin cities nearest to `cityId`, nearest first, excluding the city
 * itself. Cross-links the per-city SEO pages into a crawlable mesh — nearby by
 * distance, which for this product also means a similar latitude and so a
 * similar vitamin-D calendar. Pure and deterministic (distance ties fall back to
 * the array's name order). Returns [] if `cityId` is not a builtin city.
 */
export function nearbyCities(cityId: string, n = 5): City[] {
  const base = BUILTIN_CITIES.find((c) => c.id === cityId);
  if (!base) return [];
  return BUILTIN_CITIES.filter((c) => c.id !== base.id)
    .map((c) => ({ city: c, km: haversineKm(base.lat, base.lon, c.lat, c.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((x) => x.city);
}
