import { BUILTIN_CITIES } from "./cities";
import type { City } from "./types";

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * How far a known city may be and still name a coordinate.
 *
 * The builtin list is global but sparse, so the nearest entry to an arbitrary
 * point can be hundreds of kilometres away. Naming a place after a city that far
 * off is worse than showing the coordinates: it reads as a fact.
 */
export const NAME_MATCH_KM = 75;

/** The closest builtin city within `maxKm`, or null. */
export function nearestCityWithin(lat: number, lon: number, maxKm = NAME_MATCH_KM): City | null {
  let best: { km: number; city: City } | null = null;
  for (const city of BUILTIN_CITIES) {
    const km = haversineKm(lat, lon, city.lat, city.lon);
    if (km <= maxKm && (best === null || km < best.km)) best = { km, city };
  }
  return best?.city ?? null;
}
