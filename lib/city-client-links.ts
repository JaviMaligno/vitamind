import { CITY_PREFIX } from "./city-prefix";
import { CITY_SLUGS } from "./city-slugs";
import {
  DIRECTORY_OFFER_KM,
  EQUIVALENT_LON_DEG,
  OFFER_LAT_DEG,
  equivalentLatDeg,
  nearestBuiltin,
} from "./nearest-city";

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

/**
 * Where the "see the full city page" chip should send someone, and how honest the
 * copy has to be about it.
 *
 * - `exact`   — it really is their city. Name it, no distance.
 * - `nearby`  — a builtin city stands in. `silent: true` is the one branch allowed
 *               to name it without qualifying (the latitude band of D-4 licenses
 *               it); otherwise the copy must print `km`.
 * - `index`   — nothing worth offering. Send them to the directory, which lists
 *               eight candidates with their distances.
 *
 * There is no fourth answer: this never returns null, which is the bug it replaces
 * (the chip used to vanish, unexplained, for 54 % of searchable cities).
 */
export type DirectoryTarget =
  | { kind: "exact"; base: string }
  | { kind: "nearby"; base: string; km: number; silent: boolean }
  | { kind: "index" };

/** Smallest absolute angular difference between two longitudes, in degrees. */
function lonDelta(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Resolve the chip's destination. `cityId` is the saved place's id when there is
 * one; `lat`/`lon` are authoritative, because searched cities come back as
 * `geonames:*`, a map tap emits `custom:${Date.now()}` and a GPS fix has no id at
 * all — measuring by coordinates makes all three behave the same.
 * Client-safe (no message imports).
 */
export function directoryTarget(
  cityId: string | undefined,
  lat: number,
  lon: number,
): DirectoryTarget {
  if (cityId?.startsWith("builtin:")) return { kind: "exact", base: cityId.replace(/^builtin:/, "") };

  const hit = nearestBuiltin(lat, lon);
  if (!hit) return { kind: "index" };

  const base = hit.city.id.replace(/^builtin:/, "");
  const dLat = Math.abs(lat - hit.city.lat);
  const dLon = lonDelta(lon, hit.city.lon);

  if (dLat <= equivalentLatDeg(lat) && dLon <= EQUIVALENT_LON_DEG) {
    return { kind: "nearby", base, km: hit.km, silent: true };
  }
  if (dLat <= OFFER_LAT_DEG && hit.km <= DIRECTORY_OFFER_KM) {
    return { kind: "nearby", base, km: hit.km, silent: false };
  }
  return { kind: "index" };
}
