import { describe, it, expect } from "vitest";
import { assignSlugs, parseElevation, type SeedRow } from "@/scripts/seed-cities";

const row = (geoname_id: number, ascii_name: string, cc: string, population: number): SeedRow => ({
  geoname_id, name: ascii_name, ascii_name, country_code: cc,
  lat: 0, lon: 0, population, timezone: "UTC", elevation: null,
});

describe("assignSlugs", () => {
  it("gives the short form to the most populated of a colliding group", () => {
    const out = assignSlugs([
      row(2, "Springfield", "US", 100),
      row(1, "Springfield", "US", 500),
    ], new Set());
    expect(out.find((r) => r.geoname_id === 1)!.slug).toBe("springfield-us");
    expect(out.find((r) => r.geoname_id === 2)!.slug).toBe("springfield-us-2");
  });

  it("breaks a population tie by geoname id, so the result never depends on file order", () => {
    const a = assignSlugs([row(9, "Ávila", "ES", 10), row(4, "Avila", "ES", 10)], new Set());
    const b = assignSlugs([row(4, "Avila", "ES", 10), row(9, "Ávila", "ES", 10)], new Set());
    expect(a.find((r) => r.geoname_id === 4)!.slug).toBe("avila-es");
    expect(b.find((r) => r.geoname_id === 4)!.slug).toBe("avila-es");
  });

  it("never reassigns a slug that the database already holds", () => {
    const out = assignSlugs([row(1, "Toledo", "ES", 900)], new Set(["toledo-es"]));
    expect(out[0].slug).toBe("toledo-es-1");
  });

  it("keeps different countries apart without a tiebreak", () => {
    const out = assignSlugs([row(1, "Toledo", "ES", 900), row(2, "Toledo", "US", 800)], new Set());
    expect(out.map((r) => r.slug).sort()).toEqual(["toledo-es", "toledo-us"]);
  });
});

describe("parseElevation — GeoNames column 16 (dem)", () => {
  it("reads a real elevation", () => {
    expect(parseElevation("2640")).toBe(2640);
    expect(parseElevation("-2")).toBe(-2);
  });

  /**
   * -9999 is GeoNames' "no data" marker, not a place 10 km below the sea. Storing
   * it would feed UVI_ALTITUDE_GAIN_PER_KM a number eight hundred times wrong.
   */
  it("maps the no-data marker and empty values to null", () => {
    expect(parseElevation("-9999")).toBeNull();
    expect(parseElevation("")).toBeNull();
    expect(parseElevation("abc")).toBeNull();
  });

  /** SMALLINT is -32768..32767; nothing on Earth is outside it, but a corrupt row could be. */
  it("rejects anything outside SMALLINT range", () => {
    expect(parseElevation("40000")).toBeNull();
  });
});
