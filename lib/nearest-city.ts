import { BUILTIN_CITIES } from "./cities";
import { haversineKm } from "./geo-distance";
import type { City } from "./types";

/**
 * The single module that answers "which built-in city is near this coordinate?",
 * and the home of the thresholds that qualify that answer.
 *
 * Its primitives ALWAYS return the distance alongside the city. That is the point,
 * not a convenience: the UI can only be honest about a substitute city if it is
 * handed the number to print. The old `targetCityBase` returned a bare slug, which
 * is why the chip could say "the full Madrid page" to somebody in Bilbao without
 * ever mentioning the 323 km in between.
 *
 * Four DIFFERENT questions live here, each with its own constant (D-1). They are
 * not four versions of one threshold, so they are not merged.
 */

/** Re-exported so `lib/elevation.ts` and `lib/history-window.ts` keep working. */
export { haversineKm };

/**
 * (a) How far a known city may be and still NAME a coordinate, with no distance
 * printed beside it.
 *
 * The builtin list is global but sparse, so the nearest entry to an arbitrary
 * point can be hundreds of kilometres away. Naming a place after a city that far
 * off is worse than showing the coordinates: it reads as a fact.
 */
export const NAME_MATCH_KM = 75;

/**
 * (b) Does a city page DESCRIBE this user, or does it merely serve them?
 *
 * Latitude, not kilometres (D-3). Fixing |Δlat| and sweeping distance leaves the
 * error rate flat (5.0 % under 150 km, 2.7 % between 300 and 600 km), so distance
 * carries no information about whether the page's verdict still holds; latitude
 * does (12.3 % at 1°, 24.1 % at 2°). 400 km due east change nothing; 400 km due
 * north are 3.6° of latitude.
 *
 * Inside the tropics the band widens to 3° (D-5): below |lat| = 23.5° synthesis is
 * possible all twelve months and `contiguousMonthRange` returns null, so there is
 * no season edge to displace — measured, no tropical pair changed its verdict even
 * at 4° of offset.
 *
 * Latitude alone bounds nothing east-west (Lisbon and Vladivostok share one), and
 * the page prints CLOCK times, so silence also needs a longitude cap (D-6): 5° is
 * about 20 minutes of solar time, and the jump never exceeds one hour.
 */
export const EQUIVALENT_LAT_DEG = 1.0;
export const EQUIVALENT_LAT_DEG_TROPICS = 3.0;
export const EQUIVALENT_LON_DEG = 5;
export const TROPIC_LAT = 23.5;

/**
 * (c) Is it worth OFFERING this page at all, with the kilometres printed?
 *
 * Once the distance is on screen the offer no longer lies, so this stops being a
 * bound on truth and becomes one on usefulness (D-7). Past 3° of latitude the page
 * tells a different story (35.9 % of verdicts differ) and the user is better served
 * by the index, which shows eight candidates with their distances. The 1500 km cap
 * exists only for the east-west axis, which latitude cannot bound.
 */
export const OFFER_LAT_DEG = 3.0;
export const DIRECTORY_OFFER_KM = 1500;

/**
 * (d) May the word "near" be used unqualified?
 *
 * Shared by the chip and by the city index (`components/CityIndexSearch.tsx`),
 * which used to keep its own private 500 km. It is `EQUIVALENT_LAT_DEG` projected
 * onto the ground (1° ≈ 111 km north-south): the two screens now call the same
 * distance near, which is the asymmetry that made the chip a bug.
 */
export const NEARBY_PHRASING_KM = 100;

/**
 * The silent-equivalence latitude band at a given latitude. Evaluated on the
 * USER's latitude, not the destination's (§4.1): the question is whether the page
 * describes where the user actually is.
 */
export function equivalentLatDeg(lat: number): number {
  return Math.abs(lat) < TROPIC_LAT ? EQUIVALENT_LAT_DEG_TROPICS : EQUIVALENT_LAT_DEG;
}

/**
 * The closest builtin city to a coordinate, with its distance. Never null for a
 * finite coordinate — the builtin list is non-empty — so callers always have a
 * number to show instead of a silence to explain.
 */
export function nearestBuiltin(lat: number, lon: number): { city: City; km: number } | null {
  let best: { city: City; km: number } | null = null;
  for (const city of BUILTIN_CITIES) {
    const km = haversineKm(lat, lon, city.lat, city.lon);
    if (best === null || km < best.km) best = { city, km };
  }
  return best;
}

/** The closest builtin city within `maxKm`, with its distance, or null. */
export function nearestBuiltinWithin(
  lat: number,
  lon: number,
  maxKm: number,
): { city: City; km: number } | null {
  const hit = nearestBuiltin(lat, lon);
  return hit && hit.km <= maxKm ? hit : null;
}

/**
 * The closest builtin city within `maxKm`, or null. The name-a-coordinate case:
 * `hooks/useHistory.ts` and `lib/mcp-personal.ts` label a GPS fix with a city name
 * and print no distance, so they default to `NAME_MATCH_KM` (D-2, unchanged).
 */
export function nearestCityWithin(lat: number, lon: number, maxKm = NAME_MATCH_KM): City | null {
  return nearestBuiltinWithin(lat, lon, maxKm)?.city ?? null;
}
