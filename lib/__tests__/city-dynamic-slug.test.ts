import { describe, it, expect } from "vitest";
import {
  dynamicCitySlug, isDynamicCitySlug, aliasSlug, geonameIdFromAlias,
} from "@/lib/city-dynamic-slug";
import { CITY_SLUGS } from "@/lib/city-slugs";

describe("dynamicCitySlug", () => {
  it("qualifies every slug by country, always — not only on collision", () => {
    expect(dynamicCitySlug("Toledo", "ES")).toBe("toledo-es");
    expect(dynamicCitySlug("Toledo", "US")).toBe("toledo-us");
  });

  it("lowercases the country code and slugifies the ascii name", () => {
    expect(dynamicCitySlug("Ravensburg", "de")).toBe("ravensburg-de");
    expect(dynamicCitySlug("Sao Joao da Boa Vista", "BR")).toBe("sao-joao-da-boa-vista-br");
  });

  it("appends the geoname id when a tiebreak is required", () => {
    expect(dynamicCitySlug("Springfield", "US", 4951788)).toBe("springfield-us-4951788");
  });

  it("is a pure function of its arguments — same input, same slug, always", () => {
    expect(dynamicCitySlug("Toledo", "ES")).toBe(dynamicCitySlug("Toledo", "ES"));
  });
});

describe("isDynamicCitySlug — the syntactic prefilter that runs before touching the DB", () => {
  it("accepts the qualified and the tiebroken forms", () => {
    expect(isDynamicCitySlug("toledo-es")).toBe(true);
    expect(isDynamicCitySlug("springfield-us-4951788")).toBe(true);
  });

  it("rejects garbage without a country qualifier", () => {
    for (const s of ["aaaa", "madrid", "", "-", "a", "toledo-", "toledo-e", "toledo-esp"]) {
      expect(isDynamicCitySlug(s), s).toBe(false);
    }
  });

  it("rejects anything outside [a-z0-9-]", () => {
    for (const s of ["Toledo-es", "toledo_es", "толедо-ru", "toledo es", "toledo-es/../x"]) {
      expect(isDynamicCitySlug(s), s).toBe(false);
    }
  });

  /**
   * D-12's load-bearing claim, pinned: the two namespaces are disjoint by
   * construction, so a dynamic slug can never shadow a curated page. Measured
   * 2026-08-26: 194 distinct builtin slugs, zero ending in `-xx`.
   */
  it("never matches a curated slug, in any locale", () => {
    const all = new Set<string>();
    for (const base of Object.keys(CITY_SLUGS)) {
      for (const locale of Object.keys(CITY_SLUGS[base])) all.add(CITY_SLUGS[base][locale]);
    }
    expect(all.size).toBe(194);
    for (const slug of all) expect(isDynamicCitySlug(slug), slug).toBe(false);
  });
});

describe("the id alias — for the client that only holds a geoname id", () => {
  it("round-trips", () => {
    expect(aliasSlug(2519240)).toBe("id-2519240");
    expect(geonameIdFromAlias("id-2519240")).toBe(2519240);
  });

  it("returns null for anything that is not the alias form", () => {
    for (const s of ["toledo-es", "id-", "id-abc", "id-12.5", "id--1", ""]) {
      expect(geonameIdFromAlias(s), s).toBeNull();
    }
  });
});
