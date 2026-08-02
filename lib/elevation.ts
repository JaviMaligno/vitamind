import { BUILTIN_CITIES } from "./cities";
import { haversineKm } from "./nearest-city";

/**
 * How close a known city has to be for its altitude to describe a coordinate.
 *
 * Tight on purpose. Within a metro area the altitude is effectively the same;
 * a hundred kilometres away it is a different fact about a different place, and
 * borrowing it would be worse than admitting we do not know.
 */
export const ELEVATION_MATCH_KM = 25;

/**
 * Ground elevation for a coordinate, taken from the nearest known city, or null.
 *
 * Why this exists: the MCP tools take `elevationM` as an optional argument, and
 * the only caller is a language model. It gets the value right when it looked the
 * city up with `search_city`, and omits it when it filled the coordinates from
 * memory — which is most of the time. Defaulting to sea level then costs Madrid
 * six days of season and Bogotá, at 2640 m, considerably more, with nothing on
 * screen to suggest anything was assumed.
 *
 * Inferring it here means the answer no longer depends on the model having taken
 * the longer route. An explicit `elevationM` still wins: a caller who says 0
 * means 0.
 */
export function inferElevationM(lat: number, lon: number, maxKm = ELEVATION_MATCH_KM): number | null {
  let best: { km: number; elevation: number } | null = null;

  for (const city of BUILTIN_CITIES) {
    if (typeof city.elevation !== "number") continue;
    const km = haversineKm(lat, lon, city.lat, city.lon);
    if (km <= maxKm && (best === null || km < best.km)) {
      best = { km, elevation: city.elevation };
    }
  }

  return best ? Math.round(best.elevation) : null;
}
