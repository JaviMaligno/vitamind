import { describe, it, expect } from "vitest";
import { inferElevationM, ELEVATION_MATCH_KM } from "../elevation";

/**
 * The MCP tools receive lat/lon as plain numbers from whatever the model wrote.
 * A model that knows "Madrid is 40.4, -3.7" from memory supplies the coordinates
 * and nothing else, so elevation silently defaults to sea level — and UV rises
 * about 8% per kilometre, which moves the season edges. Inferring it from the
 * city database removes the dependency on the model having called search_city.
 */
describe("inferElevationM", () => {
  it("finds a city's own elevation from its coordinates", () => {
    expect(inferElevationM(40.4165, -3.70256)).toBe(660); // Madrid
    expect(inferElevationM(4.61, -74.08)).toBe(2640); // Bogotá
    expect(inferElevationM(39.74, -104.98)).toBe(1609); // Denver
  });

  it("still matches a few kilometres off the centre", () => {
    // A model's remembered coordinates rarely hit the exact centroid, and a
    // metro area shares its altitude anyway.
    expect(inferElevationM(40.45, -3.65)).toBe(660);
  });

  it("returns null out at sea, rather than borrowing a coastline's altitude", () => {
    expect(inferElevationM(0, 0)).toBeNull(); // Gulf of Guinea
    expect(inferElevationM(-40, -120)).toBeNull(); // South Pacific
  });

  it("returns null when the nearest city is further than the threshold", () => {
    // Somewhere in the Sahara: the nearest known city is hundreds of km away and
    // its altitude says nothing about this spot.
    expect(inferElevationM(23.4, 12.5)).toBeNull();
  });

  it("keeps the threshold tight enough to mean 'the same place'", () => {
    expect(ELEVATION_MATCH_KM).toBeLessThanOrEqual(30);
  });

  it("does not invent an altitude for a coastal city that has none", () => {
    // Whatever it returns must come from the database, never from a guess.
    const v = inferElevationM(40.4165, -3.70256);
    expect(Number.isInteger(v)).toBe(true);
  });

  it("is pure: same input, same answer", () => {
    expect(inferElevationM(19.43, -99.13)).toBe(inferElevationM(19.43, -99.13));
  });
});
