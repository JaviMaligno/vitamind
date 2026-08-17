/**
 * Turning a bearing into something a reader can point at.
 *
 * `lib/solar.ts` answers "where does the sun come up" in degrees clockwise from
 * TRUE north. Degrees alone do not answer the question people actually type —
 * "por dónde se pone el sol" wants a direction, not a number — so this module
 * names the sector, and the page prints the degrees beside the name.
 *
 * EIGHT POINTS, NOT SIXTEEN. Two reasons, in this order:
 *
 * 1. The label is not where the precision lives. The bearing ships next to it,
 *    to the degree, so a reader who wants better than a 45° sector already has
 *    it. The label's job is to be usable without an instrument, and the eight
 *    points are the ones every one of the six locales has a plain word for.
 *    Sixteen-point names ("west-northwest", "oeste-noroeste", "šiaurės šiaurės
 *    vakarai", "северо-северо-запад") are not how anyone describes a sunset.
 * 2. `lib/solar.ts` documents `declination` as the one-term approximation,
 *    worth "~1-2° of bearing" and more the further from the equator. A
 *    16-point sector is 22.5° wide against 45° for an 8-point one, so the
 *    finer label sits within one error width of a boundary exactly twice as
 *    often — a label that is wrong twice as often, for a name nobody says.
 *
 * Nothing here knows about locales: the point is an identifier, and
 * `messages/*.json` owns every word the reader sees. That split is deliberate.
 * French needs "à l'est" but "au nord-est", so a bare noun cannot be dropped
 * into a sentence with a preposition in front of it; the locale file carries
 * the whole prepositional phrase and this module only says which one.
 */

export type CompassPoint = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

/** Clockwise from north, so the index is the sector number. */
export const COMPASS_POINTS: readonly CompassPoint[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const SECTOR_DEG = 360 / COMPASS_POINTS.length;

/**
 * The eight-point name for a bearing in degrees clockwise from true north.
 *
 * Sectors are centred on their point (north spans 337.5–22.5), and a bearing
 * exactly on a boundary belongs to the sector it is entering — a partition, so
 * no bearing has two names. Any real number is accepted and wrapped: callers
 * mirror sunrise bearings through `360 - b`, which is how a value at or past
 * the end of the circle arrives.
 */
export function compassPoint(bearing: number): CompassPoint {
  const wrapped = ((bearing % 360) + 360) % 360;
  return COMPASS_POINTS[Math.floor(((wrapped + SECTOR_DEG / 2) % 360) / SECTOR_DEG)];
}

export type DueSide = "north" | "south" | "due";

export interface DueOffset {
  /** Whole degrees away from due east; 0 when the difference rounds away. */
  degrees: number;
  side: DueSide;
}

/**
 * How far a SUNRISE bearing sits from due east, and on which side.
 *
 * Sunrise only, because it also answers for sunset: `sunDirection` returns
 * `sunsetBearing = 360 - sunriseBearing`, so the two are mirror images about
 * the north-south axis and the sunset is displaced from due west by the same
 * amount, on the same side. Copy can state one figure for both, and does.
 *
 * `side` is "due" exactly when the rounded figure is 0, so no sentence ever
 * reads "0° north of due east". That branch is not reachable from the day-15
 * anchor the month page uses — the model's declination is never within half a
 * degree of zero on the 15th of any month — but the classifier admits it, so
 * it is defined and tested here rather than left to a caller's assumption.
 */
export function offsetFromDueEast(sunriseBearing: number): DueOffset {
  const degrees = Math.round(Math.abs(90 - sunriseBearing));
  if (degrees === 0) return { degrees, side: "due" };
  return { degrees, side: sunriseBearing < 90 ? "north" : "south" };
}
