import { describe, it, expect } from "vitest";
import { nearbyCities } from "@/lib/city-nearby";
import { BUILTIN_CITIES } from "@/lib/cities";
import baseline from "./fixtures/nearby-cities-baseline.json";

/**
 * Risk R-1, and verification contract §8.5.
 *
 * `lib/city-nearby.ts` is one of the four modules whose private haversine copy PR A
 * deletes, but it is NOT in `CITY_PAGE_MODULES` / `SUN_MONTH_MODULES`
 * (lib/content-fingerprint.ts), so a change in its output would slip past the
 * revision guard — while still rewriting the cross-link block of 438 city pages,
 * 2,880 month pages and 240 hubs, all of which the sitemap declares unchanged.
 *
 * The fixture was generated from the pre-refactor implementation. In PR A this file
 * must stay GREEN throughout: `lib/city-nearby.ts` is only allowed to swap its import
 * of the haversine, nothing else. If it goes red, the refactor changed published
 * content and the sitemap is lying about it.
 */
const expected = baseline as Record<string, string[]>;

describe("nearbyCities is byte-identical to its pre-refactor output", () => {
  it("covers all 73 builtin cities", () => {
    expect(Object.keys(expected)).toHaveLength(73);
    expect(BUILTIN_CITIES).toHaveLength(73);
  });

  it("returns the same five ids, in the same order, for every builtin city", () => {
    const actual: Record<string, string[]> = {};
    for (const c of BUILTIN_CITIES) actual[c.id] = nearbyCities(c.id, 5).map((x) => x.id);
    expect(actual).toEqual(expected);
  });

  it("keeps n = 5 as the default", () => {
    for (const c of BUILTIN_CITIES) {
      expect(nearbyCities(c.id).map((x) => x.id)).toEqual(expected[c.id]);
    }
  });
});
