/**
 * The one great-circle distance function in the repo.
 *
 * There used to be four byte-distinct, numerically identical copies of this
 * (`nearest-city`, `city-nearby`, `continent`, `city-client-links`), which is how
 * the same pair of coordinates could read 67 km on one screen and 68 on another.
 * Spec §8.4: exactly one definition of the earth radius across `lib/` and
 * `components/`, and it lives here.
 *
 * DELIBERATELY DEPENDENCY-FREE (D-8). `components/CityIndexSearch.tsx` is a client
 * island mounted over the SSG city index, so anything this module pulled in —
 * `BUILTIN_CITIES`, `lib/flag`, a message file — would be dragged into that page's
 * browser bundle. Keeping the file at zero dependencies makes that structural
 * rather than a comment somebody can ignore, and it is asserted by
 * `lib/__tests__/geo-distance.test.ts`.
 */

const EARTH_KM = 6371;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres between two lat/lon points (haversine). */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}
