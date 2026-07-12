import { CITY_PREFIX } from "./city-prefix";
import { CITY_SLUGS } from "./city-slugs";
import { BUILTIN_CITIES } from "./cities";

/**
 * Locale-local path of the city index (e.g. "/vitamin-d"). Client-safe: depends
 * only on the lean `CITY_PREFIX`, never on the message JSON. next-intl's `Link`
 * adds the locale prefix.
 */
export function indexPath(locale: string): string {
  return `/${CITY_PREFIX[locale] ?? CITY_PREFIX.es}`;
}

/** Locale-local path of a city's page, from the generated slug map. Null if unknown. */
export function cityPagePath(base: string, locale: string): string | null {
  const slug = CITY_SLUGS[base]?.[locale];
  if (!slug) return null;
  return `/${CITY_PREFIX[locale] ?? CITY_PREFIX.es}/${slug}`;
}

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * The base slug of the builtin city whose page best fits the current place:
 * the selected city itself when it is builtin, otherwise the nearest builtin
 * within `maxKm` of the given coordinates (so we never link somewhere absurdly
 * far). Null when nothing is close enough. Client-safe (no message imports).
 */
export function targetCityBase(
  cityId: string | undefined,
  lat: number,
  lon: number,
  maxKm = 400,
): string | null {
  if (cityId?.startsWith("builtin:")) return cityId.replace(/^builtin:/, "");
  let best: { id: string; km: number } | null = null;
  for (const c of BUILTIN_CITIES) {
    const km = haversineKm(lat, lon, c.lat, c.lon);
    if (!best || km < best.km) best = { id: c.id, km };
  }
  return best && best.km <= maxKm ? best.id.replace(/^builtin:/, "") : null;
}
