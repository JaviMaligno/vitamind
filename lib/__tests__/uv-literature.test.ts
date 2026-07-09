import { describe, it, expect } from "vitest";
import { declination, dateFromDoy } from "@/lib/solar";
import { ozoneDU, uvIndex, UVI_SYNTHESIS_THRESHOLD } from "@/lib/uv-model";

/** Noon solar elevation in degrees. */
function noonElevation(lat: number, doy: number): number {
  return 90 - Math.abs(lat - declination(doy));
}

/** 1-12 month numbers where synthesis is impossible on most days. */
function impossibleMonths(lat: number, lon: number, elevationM = 0): number[] {
  const days = Array.from({ length: 12 }, () => 0);
  const possible = Array.from({ length: 12 }, () => 0);
  for (let doy = 1; doy <= 365; doy++) {
    const m = dateFromDoy(doy).getMonth();
    days[m] += 1;
    const uvi = uvIndex(noonElevation(lat, doy), ozoneDU(lat, lon, doy), elevationM);
    if (uvi >= UVI_SYNTHESIS_THRESHOLD) possible[m] += 1;
  }
  const out: number[] = [];
  for (let m = 0; m < 12; m++) if (possible[m] * 2 < days[m]) out.push(m + 1);
  return out;
}

const JAN = 1, FEB = 2, MAR = 3, OCT = 10, NOV = 11, DEC = 12;

// Group 1 — MEASURED. These must match exactly. Webb, Kline & Holick (1988),
// J Clin Endocrinol Metab 67(2):373-378, measured 7-dehydrocholesterol ->
// previtamin D3 conversion in ampoules exposed on rooftops.
describe("measured anchors (Webb, Kline & Holick 1988)", () => {
  it("Boston (42.36N): no previtamin D3 from November through February", () => {
    expect(impossibleMonths(42.36, -71.06)).toEqual([JAN, FEB, NOV, DEC]);
  });

  it("Edmonton (53.55N): no previtamin D3 from October through March", () => {
    expect(impossibleMonths(53.55, -113.49, 668)).toEqual([JAN, FEB, MAR, OCT, NOV, DEC]);
  });
});

// Group 2 — AUTHORITATIVE STATEMENT. UK SACN, Vitamin D and Health (2016).
describe("authoritative statements", () => {
  it("London (51.51N): no synthesis October through March", () => {
    expect(impossibleMonths(51.51, -0.13)).toEqual([JAN, FEB, MAR, OCT, NOV, DEC]);
  });
});

// Group 3 — UNAMBIGUOUS CLASSES. Equatorial and subtropical cities synthesize
// year-round.
describe("year-round cities", () => {
  it.each([
    ["Singapore", 1.35, 103.82, 15],
    ["Miami", 25.76, -80.19, 2],
    ["Bogota", 4.71, -74.07, 2640],
    ["Nairobi", -1.29, 36.82, 1795],
  ])("%s has no impossible month", (_name, lat, lon, elev) => {
    expect(impossibleMonths(lat, lon, elev)).toEqual([]);
  });
});

// Group 4 — MODELED, tolerance bands. O'Neill et al. (2016), Nutrients
// 8(9):533. These are modeled, not measured, so assert a range, not an exact
// set.
describe("modeled anchors (tolerance bands)", () => {
  it("Reykjavik (64.15N) has a long winter: 6 to 8 impossible months", () => {
    const n = impossibleMonths(64.15, -21.94, 37).length;
    expect(n).toBeGreaterThanOrEqual(6);
    expect(n).toBeLessThanOrEqual(8);
  });

  it("Oslo (59.91N) has 5 to 8 impossible months", () => {
    const n = impossibleMonths(59.91, 10.75, 23).length;
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
  });

  it("Athens (37.98N) has a short winter: 1 to 3 impossible months", () => {
    const n = impossibleMonths(37.98, 23.73, 90).length;
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(3);
  });
});

// Group 5 — the southern hemisphere, and the regression this whole change
// exists to prevent.
describe("southern hemisphere", () => {
  it("Melbourne (-37.81) has its impossible months in the southern winter", () => {
    const m = impossibleMonths(-37.81, 144.96, 31);
    expect(m.length).toBeGreaterThan(0);
    // Every impossible month falls between May and August.
    for (const month of m) {
      expect(month).toBeGreaterThanOrEqual(5);
      expect(month).toBeLessThanOrEqual(8);
    }
  });
});

describe("the regression this model fixes", () => {
  // The old model (12*sin(elev)^1.3) claimed these cities synthesized vitamin D
  // in all twelve months. Each has a well-known vitamin-D winter.
  it.each([
    ["Boston", 42.36, -71.06, 0],
    ["New York", 40.71, -74.01, 10],
    ["Chicago", 41.88, -87.63, 182],
    ["Toronto", 43.65, -79.38, 76],
    ["Madrid", 40.42, -3.7, 660],
  ])("%s has a vitamin-D winter", (_name, lat, lon, elev) => {
    expect(impossibleMonths(lat, lon, elev).length).toBeGreaterThan(0);
  });
});
