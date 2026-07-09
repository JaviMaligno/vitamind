import { describe, it, expect } from "vitest";
import {
  cityYearProfile, citySeasonalWindows, contiguousMonthRange, REPRESENTATIVE_DOYS,
} from "@/lib/city-content";

describe("cityYearProfile", () => {
  it("marks high-latitude winter months impossible (Reykjavik 64.15N)", () => {
    const p = cityYearProfile(64.15);
    expect(p.allYear).toBe(false);
    expect(p.impossibleMonths).toContain(12); // December
    expect(p.impossibleMonths).toContain(1);  // January
    expect(p.possibleMonths).toContain(6);    // June
  });

  it("is possible year-round near the equator (Singapore 1.35N)", () => {
    const p = cityYearProfile(1.35);
    expect(p.allYear).toBe(true);
    expect(p.impossibleMonths).toEqual([]);
    expect(p.possibleMonths).toHaveLength(12);
  });

  // Sydney (-33.87) does NOT have a vitamin-D winter: on the June solstice its
  // noon sun still reaches ~32.7°, well over the ~20.1° threshold, leaving 5.6
  // viable hours. This matches reality (UV index >= 3 year-round in Sydney).
  // The threshold latitude is |lat| > 90 - 23.44 - MIN_UVI_ELEVATION = 46.4°,
  // and no builtin city lies beyond it in the south (the most southerly is
  // Melbourne at -37.81). So the southern flip must be asserted further south.
  it("has no impossible months in Sydney (-33.87)", () => {
    expect(cityYearProfile(-33.87).allYear).toBe(true);
  });

  it("flips the impossible band into the southern winter far enough south (-54.8)", () => {
    const p = cityYearProfile(-54.8);
    expect(p.allYear).toBe(false);
    expect(p.possibleMonths).toContain(1);   // January = southern summer
    expect(p.impossibleMonths).toEqual([5, 6, 7]); // May-July = southern winter
    // The possible band wraps across January: August → April.
    expect(contiguousMonthRange(p.possibleMonths)).toEqual({ start: 8, end: 4 });
  });

  it("returns 365 daily hour values", () => {
    expect(cityYearProfile(40.42).hoursByDay).toHaveLength(365);
  });
});

describe("contiguousMonthRange", () => {
  it("returns the band for a northern-hemisphere run", () => {
    expect(contiguousMonthRange([4, 5, 6, 7, 8, 9])).toEqual({ start: 4, end: 9 });
  });

  it("wraps across the year boundary (southern hemisphere)", () => {
    expect(contiguousMonthRange([1, 2, 3, 4, 10, 11, 12])).toEqual({ start: 10, end: 4 });
  });

  it("returns null for all-year and for empty", () => {
    expect(contiguousMonthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBeNull();
    expect(contiguousMonthRange([])).toBeNull();
  });
});

describe("citySeasonalWindows", () => {
  it("returns one entry per representative day", () => {
    const w = citySeasonalWindows(40.42, -3.7, 1); // Madrid
    expect(w).toHaveLength(REPRESENTATIVE_DOYS.length);
    expect(w.map((x) => x.doy)).toEqual(REPRESENTATIVE_DOYS);
  });

  it("marks the June solstice possible and gives a window in Madrid", () => {
    const june = citySeasonalWindows(40.42, -3.7, 1).find((x) => x.doy === 172)!;
    expect(june.possible).toBe(true);
    expect(june.windowStart).not.toBeNull();
    expect(june.windowEnd).not.toBeNull();
    expect(june.minutesNeeded).toBeGreaterThan(0);
  });

  it("marks the December solstice impossible in Reykjavik", () => {
    const dec = citySeasonalWindows(64.15, -21.94, 0).find((x) => x.doy === 355)!;
    expect(dec.possible).toBe(false);
    expect(dec.windowStart).toBeNull();
  });
});
