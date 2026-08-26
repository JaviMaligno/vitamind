import { describe, it, expect } from "vitest";
import {
  haversineKm,
  nearestBuiltin,
  nearestBuiltinWithin,
  nearestCityWithin,
  NAME_MATCH_KM,
  EQUIVALENT_LAT_DEG,
  EQUIVALENT_LAT_DEG_TROPICS,
  EQUIVALENT_LON_DEG,
  TROPIC_LAT,
  OFFER_LAT_DEG,
  DIRECTORY_OFFER_KM,
  NEARBY_PHRASING_KM,
} from "@/lib/nearest-city";
import { BUILTIN_CITIES } from "@/lib/cities";

// Coordinates used across the PR-A tests. Each one was classified against the real
// BUILTIN_CITIES table, so the branch it lands in is a fact about the data, not a
// guess. `km`/`dLat` are the measured values to the nearest builtin.
const TOLEDO = { lat: 39.8581, lon: -4.0226 };      // Madrid,  68 km, dLat 0.56
const SALAMANCA = { lat: 40.9701, lon: -5.6635 };   // Madrid, 176 km, dLat 0.55
const BILBAO = { lat: 43.2627, lon: -2.9253 };      // Madrid, 323 km, dLat 2.84
const USHUAIA = { lat: -54.8019, lon: -68.303 };    // Buenos Aires, 2374 km
const MID_PACIFIC = { lat: 0, lon: -160 };          // Honolulu, 2381 km
const SOUTH_POLE = { lat: -85, lon: 0 };            // Ciudad del Cabo, 5710 km
const NORTH_POLE = { lat: 89, lon: 0 };

describe("the surviving threshold family (spec §3, 'El esquema de umbrales que queda')", () => {
  // Four questions, four constants. Each value is load-bearing copy-adjacent policy,
  // so it is pinned here rather than left to drift silently (risk R-8: today NO test
  // in the repo pins 400, 500 or NAME_MATCH_KM).
  it("keeps NAME_MATCH_KM at 75 — naming a coordinate with no km beside it", () => {
    expect(NAME_MATCH_KM).toBe(75);
  });

  it("defines the silent-equivalence band as 1.0 deg of latitude, 3.0 in the tropics, 5 deg of longitude", () => {
    expect(EQUIVALENT_LAT_DEG).toBe(1.0);
    expect(EQUIVALENT_LAT_DEG_TROPICS).toBe(3.0);
    expect(EQUIVALENT_LON_DEG).toBe(5);
    expect(TROPIC_LAT).toBe(23.5);
  });

  it("defines the offer cap as 3.0 deg of latitude AND 1500 km", () => {
    expect(OFFER_LAT_DEG).toBe(3.0);
    expect(DIRECTORY_OFFER_KM).toBe(1500);
  });

  // The whole point of the unification: the index and the chip must call the same
  // distance "near". 100 km is 1 deg of latitude projected onto the ground.
  it("lowers the 'nearby' phrasing threshold to 100 km", () => {
    expect(NEARBY_PHRASING_KM).toBe(100);
  });

  it("keeps NEARBY_PHRASING_KM at roughly one degree of latitude", () => {
    expect(NEARBY_PHRASING_KM).toBeLessThan(haversineKm(40, 0, 40 + EQUIVALENT_LAT_DEG, 0));
    expect(NEARBY_PHRASING_KM).toBeGreaterThan(90);
  });
});

describe("nearestBuiltin", () => {
  // The primitive that makes honest copy possible: it ALWAYS returns the distance,
  // so the UI can print it instead of pretending.
  it("always answers, however remote the point", () => {
    for (const p of [USHUAIA, MID_PACIFIC, SOUTH_POLE, NORTH_POLE, TOLEDO]) {
      const hit = nearestBuiltin(p.lat, p.lon);
      expect(hit).not.toBeNull();
      expect(typeof hit!.km).toBe("number");
      expect(Number.isFinite(hit!.km)).toBe(true);
    }
  });

  it("returns the true minimum over BUILTIN_CITIES, with its distance", () => {
    for (const p of [TOLEDO, SALAMANCA, BILBAO, USHUAIA, MID_PACIFIC]) {
      const hit = nearestBuiltin(p.lat, p.lon)!;
      const brute = BUILTIN_CITIES.map((c) => haversineKm(p.lat, p.lon, c.lat, c.lon)).sort((a, b) => a - b)[0];
      expect(hit.km).toBeCloseTo(brute, 9);
      expect(hit.km).toBeCloseTo(haversineKm(p.lat, p.lon, hit.city.lat, hit.city.lon), 9);
    }
  });

  it("picks Madrid for Toledo and Buenos Aires for Ushuaia", () => {
    expect(nearestBuiltin(TOLEDO.lat, TOLEDO.lon)!.city.id).toBe("builtin:madrid");
    expect(Math.round(nearestBuiltin(TOLEDO.lat, TOLEDO.lon)!.km)).toBe(68);
    expect(nearestBuiltin(USHUAIA.lat, USHUAIA.lon)!.city.id).toBe("builtin:buenos-aires");
    expect(Math.round(nearestBuiltin(USHUAIA.lat, USHUAIA.lon)!.km)).toBe(2374);
  });
});

describe("nearestBuiltinWithin", () => {
  it("respects the cap and still reports the distance", () => {
    const hit = nearestBuiltinWithin(TOLEDO.lat, TOLEDO.lon, 100)!;
    expect(hit.city.id).toBe("builtin:madrid");
    expect(Math.round(hit.km)).toBe(68);
  });

  it("returns null when nothing is inside the cap", () => {
    expect(nearestBuiltinWithin(TOLEDO.lat, TOLEDO.lon, 50)).toBeNull();
    expect(nearestBuiltinWithin(MID_PACIFIC.lat, MID_PACIFIC.lon, 400)).toBeNull();
  });
});

// Migrated caller, NOT a behaviour change: hooks/useHistory.ts and lib/mcp-personal.ts
// must keep seeing exactly what they see today. NAME_MATCH_KM is explicitly out of
// scope per D-2. This block is expected to be green before AND after the refactor.
describe("nearestCityWithin — unchanged for useHistory / mcp-personal", () => {
  it("still defaults to NAME_MATCH_KM and returns the City itself", () => {
    expect(nearestCityWithin(TOLEDO.lat, TOLEDO.lon)?.id).toBe("builtin:madrid");
    expect(nearestCityWithin(SALAMANCA.lat, SALAMANCA.lon)).toBeNull();
  });

  it("still honours an explicit cap", () => {
    expect(nearestCityWithin(SALAMANCA.lat, SALAMANCA.lon, 200)?.id).toBe("builtin:madrid");
    expect(nearestCityWithin(TOLEDO.lat, TOLEDO.lon, 50)).toBeNull();
  });

  it("agrees with nearestBuiltinWithin, of which it is a one-liner", () => {
    for (const p of [TOLEDO, SALAMANCA, BILBAO]) {
      for (const cap of [50, 75, 200, 400]) {
        expect(nearestCityWithin(p.lat, p.lon, cap)?.id ?? null).toBe(
          nearestBuiltinWithin(p.lat, p.lon, cap)?.city.id ?? null,
        );
      }
    }
  });
});

// lib/elevation.ts:2 and lib/history-window.ts:5 import haversineKm from here and are
// out of scope for PR A, so the re-export must survive the extraction.
describe("haversineKm re-export", () => {
  it("is still exported from lib/nearest-city", () => {
    expect(typeof haversineKm).toBe("function");
    expect(haversineKm(39.8581, -4.0226, 40.42, -3.7)).toBeCloseTo(68.23, 2);
  });
});
