import { describe, it, expect } from "vitest";
import {
  cityYearProfile, citySeasonalWindows, contiguousMonthRange, REPRESENTATIVE_DOYS,
} from "@/lib/city-content";

// The threshold is not a constant: ozone varies with latitude, longitude and
// season, so these take the city's real (lat, lon, elevation).
describe("cityYearProfile", () => {
  it("marks high-latitude winter months impossible (Reykjavik 64.15N)", () => {
    const p = cityYearProfile(64.15, -21.94, 37);
    expect(p.allYear).toBe(false);
    expect(p.impossibleMonths).toContain(12); // December
    expect(p.impossibleMonths).toContain(1);  // January
    expect(p.possibleMonths).toContain(6);    // June
  });

  it("is possible year-round near the equator (Singapore 1.35N)", () => {
    const p = cityYearProfile(1.35, 103.82, 15);
    expect(p.allYear).toBe(true);
    expect(p.impossibleMonths).toEqual([]);
    expect(p.possibleMonths).toHaveLength(12);
  });

  // SACN, "Vitamin D and Health" (2016): no synthesis in the UK from October
  // through March. The old model claimed London synthesized in nine months.
  it("gives London (51.51N) a vitamin-D winter of October through March", () => {
    const p = cityYearProfile(51.51, -0.13, 11);
    expect(p.impossibleMonths).toEqual([1, 2, 3, 10, 11, 12]);
  });

  // The old model claimed Madrid synthesized all twelve months.
  it("gives Madrid (40.42N) a vitamin-D winter", () => {
    expect(cityYearProfile(40.42, -3.7, 660).allYear).toBe(false);
  });

  // Cancer Council Australia: UV index >= 3 year-round in Sydney.
  // Sydney is a knife-edge city, and the ONLY one of the 73 whose month
  // classification depends on elevation: at sea level it loses June, and its
  // real 58 m restores it. Longitude matters too (the ozone term at lon 151
  // differs from lon 0). Both are passed here, so both are exercised.
  it("has no impossible months in Sydney, given its real lon and elevation", () => {
    expect(cityYearProfile(-33.87, 151.21, 58).allYear).toBe(true);
    // Pin the sensitivity, so a future change to the altitude term shows up here.
    expect(cityYearProfile(-33.87, 151.21, 0).impossibleMonths).toEqual([6]);
  });

  it("gives Melbourne (-37.81) an impossible band in the southern winter", () => {
    const p = cityYearProfile(-37.81, 144.96, 31);
    expect(p.impossibleMonths).toEqual([5, 6, 7]); // May-July
    expect(p.possibleMonths).toContain(1);         // January = southern summer
  });

  it("wraps the possible band across January far enough south (-54.8)", () => {
    const p = cityYearProfile(-54.8, -68.3, 0); // Ushuaia
    expect(p.allYear).toBe(false);
    expect(p.possibleMonths).toContain(1);
    const band = contiguousMonthRange(p.possibleMonths);
    expect(band).not.toBeNull();
    expect(band!.start).toBeGreaterThan(band!.end); // it wraps across January
  });

  it("returns 365 daily hour values", () => {
    expect(cityYearProfile(40.42, -3.7, 660).hoursByDay).toHaveLength(365);
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
    const w = citySeasonalWindows(40.42, -3.7, 1, 660); // Madrid
    expect(w).toHaveLength(REPRESENTATIVE_DOYS.length);
    expect(w.map((x) => x.doy)).toEqual(REPRESENTATIVE_DOYS);
  });

  it("marks the June solstice possible and gives a window in Madrid", () => {
    const june = citySeasonalWindows(40.42, -3.7, 1, 660).find((x) => x.doy === 172)!;
    expect(june.possible).toBe(true);
    expect(june.windowStart).not.toBeNull();
    expect(june.windowEnd).not.toBeNull();
    expect(june.minutesNeeded).toBeGreaterThan(0);
  });

  it("marks the December solstice impossible in Reykjavik", () => {
    const dec = citySeasonalWindows(64.15, -21.94, 0, 37).find((x) => x.doy === 355)!;
    expect(dec.possible).toBe(false);
    expect(dec.windowStart).toBeNull();
  });

  // Altitude means more UV, so less time is needed for the same dose.
  it("needs fewer minutes at altitude than at sea level", () => {
    const doy = 172;
    const sea = citySeasonalWindows(4.71, -74.07, -5, 0).find((x) => x.doy === doy)!;
    const high = citySeasonalWindows(4.71, -74.07, -5, 2640).find((x) => x.doy === doy)!; // Bogota
    expect(high.minutesNeeded!).toBeLessThan(sea.minutesNeeded!);
  });
});
