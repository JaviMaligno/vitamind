import { describe, it, expect } from "vitest";
import { ozoneDU, uvIndex } from "@/lib/uv-model";

/**
 * WHAT THIS FILE IS, AND WHAT IT IS NOT.
 *
 * It is not a validation of `lib/uv-model.ts`. `uv-literature.test.ts` does
 * that, against measured and authoritative anchors, and those still pass.
 *
 * This file records a DISAGREEMENT that the literature anchors cannot see,
 * because every one of them is a high-latitude winter with the sun low
 * (Boston Nov-Feb, Edmonton Oct-Mar, London Oct-Mar). Sampled against
 * Open-Meteo on 2026-09-22, our clear-sky model and theirs diverge by up to a
 * factor of two once the sun is high, and the ozone column is the mechanism —
 * van Heuklon (1979) is a closed-form fit to pre-1979 data with no day-to-day
 * term. Full working in docs/uv-sources.md.
 *
 * THE SAMPLES BELOW ARE NOT GROUND TRUTH. They are what one forecast implied on
 * one day, recovered by inverting `uvIndex` on the near-clear hours. Nobody here
 * has compared either model against a ground station. So the assertions are
 * about the SHAPE of the disagreement, which is what is actually established,
 * and never about which model is right.
 *
 * The one that matters is the last: the error changes sign with latitude. That
 * is what rules out the obvious repair — nudging van Heuklon's baseline — and
 * it is the reason this is still an open question rather than a fixed bug.
 */

/** Total column ozone (DU) that would make `uvIndex` reproduce Open-Meteo's
 *  near-clear reading, at that city's peak solar elevation for the day. */
const IMPLIED = [
  { city: "London", lat: 51.51, lon: -0.13, doy: 268, impliedDU: 264 },
  { city: "London", lat: 51.51, lon: -0.13, doy: 269, impliedDU: 316 },
  { city: "Madrid", lat: 40.42, lon: -3.7, doy: 265, impliedDU: 326 },
  { city: "Madrid", lat: 40.42, lon: -3.7, doy: 268, impliedDU: 319 },
  { city: "Sydney", lat: -33.87, lon: 151.21, doy: 267, impliedDU: 358 },
  { city: "Sydney", lat: -33.87, lon: 151.21, doy: 269, impliedDU: 356 },
  { city: "Tokyo", lat: 35.68, lon: 139.69, doy: 265, impliedDU: 327 },
  { city: "Tokyo", lat: 35.68, lon: 139.69, doy: 267, impliedDU: 332 },
  { city: "Nairobi", lat: -1.29, lon: 36.82, doy: 267, impliedDU: 408 },
] as const;

describe("the ozone column our model assumes, against a forecast's", () => {
  it("cannot be repaired by shifting the baseline: the error changes sign", () => {
    // THE LOAD-BEARING ASSERTION. van Heuklon reads ~69 DU HIGH over London
    // (too little UV) and ~173 DU LOW over Nairobi (too much). Adding a
    // constant fixes one end by worsening the other, so the latitude amplitude
    // of the 1979 fit is wrong, not merely its offset. Anyone reaching for
    // `J = 235 + something` should fail here first.
    const errors = IMPLIED.map((s) => ozoneDU(s.lat, s.lon, s.doy) - s.impliedDU);
    expect(errors.some((e) => e > 0)).toBe(true);
    expect(errors.some((e) => e < 0)).toBe(true);
  });

  it("is closest where the literature anchors actually live", () => {
    // Mid-latitude autumn, sun low: the model is within the day-to-day spread
    // of real ozone (roughly +/-50 DU), which is all a climatology can promise.
    const midLatitude = IMPLIED.filter((s) => Math.abs(s.lat) > 30);
    for (const s of midLatitude) {
      const err = Math.abs(ozoneDU(s.lat, s.lon, s.doy) - s.impliedDU);
      expect(err, `${s.city} doy ${s.doy}`).toBeLessThan(80);
    }
  });

  it("diverges most at the equator, where nothing validated it", () => {
    // Not a claim that 408 DU is the real column over Nairobi — it is not a
    // plausible equatorial value at all, which is the point: no ozone number
    // reconciles the two models there, so the form is wrong and not just the
    // input. `uv-model.ts` names the suspect itself: a ~235 DU equatorial
    // baseline that modern satellite-era means exceed.
    const nairobi = IMPLIED.find((s) => s.city === "Nairobi")!;
    expect(ozoneDU(nairobi.lat, nairobi.lon, nairobi.doy)).toBeCloseTo(235, 0);
    expect(nairobi.impliedDU - ozoneDU(nairobi.lat, nairobi.lon, nairobi.doy)).toBeGreaterThan(150);
  });

  it("still reaches implausible clear-sky peaks at high sun", () => {
    // Recorded so a future change to the ozone source is a visible diff here
    // rather than a silent shift in what 14 of the 73 cities publish.
    const peakAtZenith = (lat: number, lon: number, doy: number, elevM: number) =>
      uvIndex(90 - Math.abs(lat), ozoneDU(lat, lon, doy), elevM);
    expect(peakAtZenith(-1.29, 36.82, 267, 1795)).toBeGreaterThan(18); // Nairobi
    expect(peakAtZenith(4.71, -74.07, 80, 2640)).toBeGreaterThan(18); // Bogota
  });
});
