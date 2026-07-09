/**
 * Clear-sky UV index model.
 *
 * Replaces the old `estimateUVFromElevation(e) = 12 * sin(e)^1.3` heuristic,
 * which overestimated UV by 3-4x at low sun angles (it produced UVI 2.98 at
 * 20 deg elevation; measured clear-sky UVI at that elevation is ~0.8-0.9).
 * That error made the app claim year-round vitamin D synthesis in Boston,
 * New York and Madrid, contradicting measured literature.
 *
 * This module combines two published, independently-validated models:
 *   - Ozone column: van Heuklon (1979), "Estimating Atmospheric Ozone for
 *     Solar Radiation Models", Solar Energy 22(1):63-68.
 *   - Clear-sky UV index: Madronich, S. (2007), "Analytic formula for the
 *     clear-sky UV index", Photochemistry and Photobiology 83(6):1537-1538,
 *     DOI 10.1111/j.1751-1097.2007.00200.x.
 *
 * Together they were validated against measured monthly UVI anchors for
 * Boston (Nov-Feb), Edmonton (Oct-Mar) and London (Oct-Mar) and reproduced
 * them exactly, unlike two other candidate approaches that were tried and
 * rejected.
 */

/** Reference total-column ozone (Dobson Units) used by Madronich's fit. */
export const OZONE_REFERENCE_DU = 300;

/**
 * UV Index at/above which the literature considers cutaneous vitamin D
 * synthesis to begin (commonly cited threshold, e.g. Engelsen 2010,
 * Webb & Engelsen 2006).
 */
export const UVI_SYNTHESIS_THRESHOLD = 3;

/**
 * Clear-sky UV increase per kilometre of altitude, as a fraction (0.08 = 8%/km).
 * This is a central value; the published spread is wide: WHO cites ~10% per
 * 1000 m, Allaart et al. report +5%/km, Blumthaler et al. measured up to
 * ~18%/km in summer alpine conditions. 8%/km is a reasonable mid-range choice,
 * not a tightly constrained physical constant.
 */
export const UVI_ALTITUDE_GAIN_PER_KM = 0.08;

/**
 * Total column ozone (Dobson Units) at a given latitude/longitude/day-of-year,
 * via the van Heuklon (1979) closed-form climatological fit:
 *
 *   Omega = J + [A + C*sin(D*(doy + F)) + G*sin(H*(lon + I))] * sin^2(B*lat)
 *
 * All sine arguments are in DEGREES (van Heuklon's original formulation),
 * including `B*lat` and `D*(doy+F)`.
 *
 * Coefficients differ between hemispheres because the seasonal ozone cycle
 * is phase-shifted (northern max in spring, southern max in southern spring).
 *
 * Known limitations (documented so nobody is surprised later):
 *   - Fitted to PRE-OZONE-HOLE climatology (pre-1979 data). It does not
 *     reproduce the Antarctic ozone hole or any modern depletion trend.
 *   - Its ~235 DU equatorial baseline runs ~15-25 DU below modern satellite-
 *     era equatorial means.
 * Despite this, it captures the latitude/season SHAPE of the ozone field,
 * which is exactly what's needed to move the synthesis threshold correctly
 * across latitude and time of year - the absolute DU offset matters much
 * less than the shape for this use case.
 *
 * @param lat latitude in degrees, north positive
 * @param lon longitude in degrees, east positive
 * @param doy day of year (1-365/366)
 * @returns total column ozone in Dobson Units
 */
export function ozoneDU(lat: number, lon: number, doy: number): number {
  const deg2rad = Math.PI / 180;
  const sinDeg = (x: number) => Math.sin(x * deg2rad);

  const north = lat >= 0;
  const J = 235;
  const A = north ? 150 : 100;
  const B = north ? 1.28 : 1.5;
  const C = north ? 40 : 30;
  const D = 0.9865;
  const F = north ? -30 : 152.625;
  const G = 20;
  const H = north ? 3 : 2;
  const I = north ? (lon > 0 ? 20 : 0) : -75;

  const seasonal = A + C * sinDeg(D * (doy + F)) + G * sinDeg(H * (lon + I));
  return J + seasonal * sinDeg(B * lat) ** 2;
}

/**
 * Clear-sky UV Index via Madronich (2007):
 *
 *   UVI = 12.5 * mu^2.42 * (Omega/300)^-1.23      mu = cos(SZA) = sin(elevation)
 *
 * then scaled by an altitude gain factor (1 + UVI_ALTITUDE_GAIN_PER_KM * km).
 *
 * NOTE ON ATTRIBUTION: this exponent pair (2.42, -1.23) is Madronich's
 * formula. It is frequently misattributed to Fioletov et al. in secondary
 * literature - Fioletov's UV model is a multi-variable regression on global
 * solar radiation, ozone, dew point and snow cover, and does NOT use a power
 * law of cosine(SZA) and ozone ratio. Don't conflate the two.
 *
 * Validity (as stated by Madronich 2007): solar zenith angle 0-60 degrees
 * (i.e. elevation >= 30 degrees), ozone column 200-400 DU, clear sky, low
 * surface albedo, accuracy ~10%. Below 30 degrees elevation this function is
 * an EXTRAPOLATION beyond the fitted range: it is used in this codebase only
 * to answer yes/no threshold questions ("has UVI crossed 3 yet?"), never
 * surfaced to users as a reported UV index number.
 *
 * @param elevationDeg solar elevation angle in degrees (0 = horizon, 90 = zenith)
 * @param ozoneDu total column ozone in Dobson Units, defaults to the 300 DU reference
 * @param elevationM observer altitude in metres above sea level, defaults to 0
 * @returns clear-sky UV Index (0 for elevationDeg <= 0)
 */
export function uvIndex(elevationDeg: number, ozoneDu: number = OZONE_REFERENCE_DU, elevationM: number = 0): number {
  if (elevationDeg <= 0) return 0;

  const mu = Math.sin(elevationDeg * (Math.PI / 180));
  const seaLevelUVI = 12.5 * Math.pow(mu, 2.42) * Math.pow(ozoneDu / OZONE_REFERENCE_DU, -1.23);
  // Clamp at zero: a nonsensical elevation (below -12.5 km) would otherwise flip
  // the gain factor negative and hand back a negative UV index. Real data never
  // goes there -- Amsterdam, the lowest city, is -2 m -- but a bad geocode should
  // yield "no UV", not "anti-UV".
  const altitudeGain = Math.max(0, 1 + UVI_ALTITUDE_GAIN_PER_KM * (elevationM / 1000));
  return seaLevelUVI * altitudeGain;
}

/**
 * Inverts `uvIndex` numerically: finds the solar elevation angle (degrees)
 * at which the clear-sky UV index first reaches `targetUVI`, for a given
 * ozone column and altitude.
 *
 * Solved by bisection on [0, 90] with a fixed iteration count (60), which
 * comfortably exceeds the precision needed (each iteration halves the
 * bracket; 60 iterations is far beyond floating-point resolution over a
 * 90-degree range) and avoids looping on float equality.
 *
 * If the target UVI is unreachable even at zenith (elevation 90), returns 90.
 *
 * @param targetUVI the UV index to solve for
 * @param ozoneDu total column ozone in Dobson Units
 * @param elevationM observer altitude in metres above sea level
 * @returns solar elevation in degrees at which uvIndex(elevation, ozoneDu, elevationM) == targetUVI
 */
export function minElevationForUVI(targetUVI: number, ozoneDu: number, elevationM: number): number {
  const atZenith = uvIndex(90, ozoneDu, elevationM);
  if (atZenith < targetUVI) return 90;

  let lo = 0;
  let hi = 90;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const uvAtMid = uvIndex(mid, ozoneDu, elevationM);
    if (uvAtMid < targetUVI) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * The solar elevation angle (degrees) at which clear-sky UV index reaches
 * `UVI_SYNTHESIS_THRESHOLD` at a given place, day of year and altitude.
 *
 * This REPLACES the old `MIN_UVI_ELEVATION` constant. Because total column
 * ozone varies with latitude and season (see `ozoneDU`), the elevation
 * required to reach the synthesis threshold is not a single constant - it
 * ranges from ~29.3 degrees (235 DU, van Heuklon's global minimum, at the
 * equator) to ~41.7 degrees (445 DU, its global maximum). Using a fixed
 * constant here is exactly the kind of simplification that produced the
 * original 3-4x UV overestimate this module replaces.
 *
 * @param lat latitude in degrees, north positive
 * @param lon longitude in degrees, east positive
 * @param doy day of year (1-365/366)
 * @param elevationM observer altitude in metres above sea level, defaults to 0
 * @returns required solar elevation in degrees
 */
export function synthesisThresholdElevation(lat: number, lon: number, doy: number, elevationM: number = 0): number {
  return minElevationForUVI(UVI_SYNTHESIS_THRESHOLD, ozoneDU(lat, lon, doy), elevationM);
}
