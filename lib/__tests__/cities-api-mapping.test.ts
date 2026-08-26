import { describe, it, expect } from "vitest";
import { toCity } from "@/lib/cities-api";

const ROW = {
  geoname_id: 3688689, name: "Bogotá", ascii_name: "Bogota", country_code: "CO",
  lat: 4.61, lon: -74.08, population: 7674366, timezone: "America/Bogota",
  elevation: 2640, slug: "bogota-co", display_name: "Bogotá",
};

describe("toCity", () => {
  /**
   * Elevation is not decoration here: with UVI_ALTITUDE_GAIN_PER_KM = 0.08,
   * serving Bogota at sea level changes the month count the app prints. Before
   * this, EVERY searched city was sea level.
   */
  it("carries the real elevation through, instead of leaving it undefined", () => {
    expect(toCity(ROW).elevation).toBe(2640);
  });

  it("carries the canonical slug", () => {
    expect(toCity(ROW).slug).toBe("bogota-co");
  });

  it("keeps working for a row that predates the two columns", () => {
    // Keys absent altogether, which is a real shape: a response served before
    // the migration reached the database. (Deleting beats destructuring off a
    // rest here only because the two discarded bindings trip no-unused-vars.)
    const old: Record<string, unknown> = { ...ROW };
    delete old.elevation;
    delete old.slug;
    const city = toCity(old as never);
    expect(city.elevation).toBeUndefined();
    expect(city.slug).toBeUndefined();
    expect(city.timezone).toBe("America/Bogota");
  });

  /**
   * NOT the same case as the one above, and the one that actually happens in
   * production. The migration adds both columns as NULLABLE and every RPC
   * selects them, so between applying the migration and finishing the re-seed
   * the columns EXIST and every row carries `null` — the wire shape is
   * `{"slug": null}`, not an absent key.
   *
   * `City.slug` is typed `string | undefined`, so a null flowing through would
   * be a lie the type system cannot catch, and the first consumer to build a
   * link out of it publishes an href ending in `/null`. Same for elevation:
   * `?? undefined` keeps "not measured" distinct from "at sea level", which is
   * what the 437 GeoNames rows with no `dem` value need.
   */
  it("maps an explicit null from a migrated-but-unseeded row to undefined", () => {
    const city = toCity({ ...ROW, slug: null, elevation: null } as never);
    expect(city.slug).toBeUndefined();
    expect(city.elevation).toBeUndefined();
  });
});
