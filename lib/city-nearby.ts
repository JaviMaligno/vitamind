import { BUILTIN_CITIES } from "./cities";
import { haversineKm } from "./geo-distance";
import type { City } from "./types";

/**
 * The `n` builtin cities nearest to a COORDINATE, nearest first — including one
 * that sits on the coordinate itself. Always over BUILTIN_CITIES, never over the
 * dynamic set: every outbound link from an on-demand page must land on an
 * indexable page. A dynamic-to-dynamic mesh would spread link flow across
 * 1.4 M `noindex` URLs, which is the residual SEO risk D-15 closes.
 *
 * Ties in distance fall back to the order of BUILTIN_CITIES, because
 * Array#sort is stable.
 */
export function nearbyCitiesTo(lat: number, lon: number, n = 5): City[] {
  return BUILTIN_CITIES
    .map((c) => ({ city: c, km: haversineKm(lat, lon, c.lat, c.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((x) => x.city);
}

/**
 * The `n` builtin cities nearest to `cityId`, nearest first, excluding the city
 * itself. Cross-links the per-city SEO pages into a crawlable mesh — nearby by
 * distance, which for this product also means a similar latitude and so a
 * similar vitamin-D calendar. Pure and deterministic (distance ties fall back to
 * the array's name order). Returns [] if `cityId` is not a builtin city.
 *
 * Asks for `n + 1` and drops the city itself afterwards: at zero km the city is
 * always inside that window, so the survivors are the same `n` — and in the same
 * order — that filtering first used to produce. `lib/__tests__/city-nearby.test.ts`
 * checks that equivalence over all 73 builtins, and
 * `lib/__tests__/city-nearby-baseline.test.ts` pins the output itself, because
 * this order is published content on 3,558 pages.
 */
export function nearbyCities(cityId: string, n = 5): City[] {
  const base = BUILTIN_CITIES.find((c) => c.id === cityId);
  if (!base) return [];
  return nearbyCitiesTo(base.lat, base.lon, n + 1).filter((c) => c.id !== base.id).slice(0, n);
}
