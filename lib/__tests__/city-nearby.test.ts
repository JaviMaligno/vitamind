import { describe, it, expect } from "vitest";
import { nearbyCities } from "@/lib/city-nearby";
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
