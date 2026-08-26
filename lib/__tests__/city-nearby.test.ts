import { describe, it, expect } from "vitest";
import { nearbyCities, nearbyCitiesTo } from "@/lib/city-nearby";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug } from "@/lib/city-routes";

describe("nearbyCities", () => {
  const slugs = (cityId: string, n?: number) =>
    nearbyCities(cityId, n).map((c) => baseSlug(c.id));

  it("returns the nearest cities, nearest first, excluding itself", () => {
    // Madrid's five nearest are the Iberian cluster (302-505 km).
    expect(slugs("builtin:madrid", 5)).toEqual([
      "valencia", "sevilla", "malaga", "lisboa", "barcelona",
    ]);
  });

  it("never includes the city itself", () => {
    for (const city of BUILTIN_CITIES) {
      expect(nearbyCities(city.id).map((c) => c.id)).not.toContain(city.id);
    }
  });

  it("defaults to 5 and respects a custom n", () => {
    expect(nearbyCities("builtin:madrid")).toHaveLength(5);
    expect(nearbyCities("builtin:madrid", 3)).toHaveLength(3);
  });

  it("orders by increasing distance", () => {
    const s = slugs("builtin:singapur", 5);
    expect(s[0]).toBe("kuala-lumpur");                     // 309 km
    expect(s.indexOf("bangkok")).toBeLessThan(s.indexOf("shanghai"));
  });

  it("returns an empty array for an unknown city", () => {
    expect(nearbyCities("builtin:atlantis")).toEqual([]);
  });
});

describe("nearbyCitiesTo — cross-links for a page that is not itself a builtin", () => {
  it("returns builtin cities only, so every outbound link points at an indexable page", () => {
    const got = nearbyCitiesTo(39.86, -4.02, 5);   // Toledo
    expect(got).toHaveLength(5);
    for (const c of got) expect(c.id.startsWith("builtin:")).toBe(true);
  });

  it("orders them by distance, nearest first", () => {
    const got = nearbyCitiesTo(39.86, -4.02, 5);
    expect(baseSlug(got[0].id)).toBe("madrid");
  });

  it("includes the city itself when the coordinate IS a builtin — the caller excludes it", () => {
    const madrid = BUILTIN_CITIES.find((c) => baseSlug(c.id) === "madrid")!;
    expect(baseSlug(nearbyCitiesTo(madrid.lat, madrid.lon, 1)[0].id)).toBe("madrid");
  });

  /**
   * The refactor guard (spec R-1). `nearbyCities` decides the cross-link block of
   * 438 city pages + 2880 month pages + 240 hubs, and the ORDER of those links is
   * published content. If it moves, content ships to 3,558 pages the sitemap
   * declares unchanged.
   */
  it("leaves nearbyCities byte-identical for every builtin city", () => {
    for (const city of BUILTIN_CITIES) {
      const viaId = nearbyCities(city.id).map((c) => c.id);
      const viaCoords = nearbyCitiesTo(city.lat, city.lon, 6)
        .filter((c) => c.id !== city.id).slice(0, 5).map((c) => c.id);
      expect(viaCoords, city.id).toEqual(viaId);
    }
  });
});
