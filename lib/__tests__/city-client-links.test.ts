import { describe, it, expect } from "vitest";
import * as links from "@/lib/city-client-links";
import { directoryTarget, indexPath, cityPagePath } from "@/lib/city-client-links";
import { haversineKm, nearestBuiltin } from "@/lib/nearest-city";
import { BUILTIN_CITIES } from "@/lib/cities";

/**
 * `directoryTarget` (spec §4.1) is the whole of PR A's decision logic. Every fixture
 * below was classified against the real BUILTIN_CITIES table, so the branch is a fact
 * about the data: the comment gives the destination, the measured great-circle
 * distance and the latitude delta that decides the branch.
 */
const MADRID = { lat: 40.42, lon: -3.7 };
const GETAFE = { lat: 40.3057, lon: -3.7327 };        // Madrid,  13 km, dLat 0.11
const TOLEDO = { lat: 39.8581, lon: -4.0226 };        // Madrid,  68 km, dLat 0.56
const SALAMANCA = { lat: 40.9701, lon: -5.6635 };     // Madrid, 176 km, dLat 0.55, dLon 1.96
const NAPLES = { lat: 40.8518, lon: 14.2681 };        // Rome,   188 km, dLat 1.05
const BILBAO = { lat: 43.2627, lon: -2.9253 };        // Madrid, 323 km, dLat 2.84
const SANTANDER = { lat: 43.4623, lon: -3.81 };       // Madrid, 338 km, dLat 3.04
const SURAT = { lat: 21.17, lon: 72.83 };             // Mumbai, 232 km, dLat 2.09, |lat| < 23.5
const TROPICAL_GULF = { lat: 23.0, lon: 55.27 };      // Dubai,  245 km, dLat 2.20, user inside tropics
const TEMPERATE_GULF = { lat: 24.0, lon: 55.27 };     // Dubai,  133 km, dLat 1.20, user outside tropics
const ICELAND_LON4 = { lat: 64.15, lon: -25.94 };     // Reykjavik, 194 km, dLat 0, dLon 4
const ICELAND_LON6 = { lat: 64.15, lon: -27.94 };     // Reykjavik, 291 km, dLat 0, dLon 6
const ICELAND_1488 = { lat: 64.15, lon: -52.94 };     // Reykjavik, 1488 km, dLat 0
const ICELAND_1582 = { lat: 64.15, lon: -54.94 };     // Reykjavik, 1582 km, dLat 0
const USHUAIA = { lat: -54.8019, lon: -68.303 };      // Buenos Aires, 2374 km, dLat 20.2
const MID_PACIFIC = { lat: 0, lon: -160 };            // Honolulu, 2381 km, dLat 21.3
const SOUTH_POLE = { lat: -85, lon: 0 };              // Cape Town, 5710 km

const target = (p: { lat: number; lon: number }, cityId?: string) =>
  directoryTarget(cityId, p.lat, p.lon);

describe("directoryTarget — rule 1: a builtin id is exact", () => {
  it("links straight to the builtin city's own page", () => {
    expect(target(MADRID, "builtin:madrid")).toEqual({ kind: "exact", base: "madrid" });
  });

  it("strips only the builtin: prefix, whatever the base slug", () => {
    expect(target({ lat: 40.71, lon: -74.01 }, "builtin:nueva-york")).toEqual({
      kind: "exact",
      base: "nueva-york",
    });
  });

  it("does not treat a searched (geonames) or map-tapped (custom) id as exact", () => {
    expect(target(TOLEDO, "geonames:2510409").kind).toBe("nearby");
    expect(target(TOLEDO, "custom:1755000000000").kind).toBe("nearby");
    expect(target(TOLEDO, undefined).kind).toBe("nearby");
  });
});

describe("directoryTarget — rule 2: the silent equivalence band is latitude, not km", () => {
  it("stays silent for a suburb", () => {
    expect(target(GETAFE)).toMatchObject({ kind: "nearby", base: "madrid", silent: true });
  });

  it("stays silent for Toledo", () => {
    expect(target(TOLEDO)).toMatchObject({ kind: "nearby", base: "madrid", silent: true });
  });

  // D-3: 176 km due west of Madrid changes nothing the page says, because the
  // latitude barely moves. The old 400 km rule could not express this; the point of
  // the new one is that distance alone never decides.
  it("stays silent 176 km away when the latitude barely moves", () => {
    expect(target(SALAMANCA)).toMatchObject({ kind: "nearby", base: "madrid", silent: true });
  });

  // D-5: inside the tropics there is no season edge to move, so the band widens.
  it("widens to 3 deg inside the tropics", () => {
    expect(target(SURAT)).toMatchObject({ kind: "nearby", base: "bombay", silent: true });
  });

  // §4.1: EQUIV is evaluated on the USER's latitude, not the destination's. These two
  // points share a longitude and a destination and differ by one degree of latitude;
  // only the first is inside the tropics, and only the first may stay silent.
  it("evaluates the tropical band on the user's latitude", () => {
    expect(target(TROPICAL_GULF)).toMatchObject({ kind: "nearby", base: "dubai", silent: true });
    expect(target(TEMPERATE_GULF)).toMatchObject({ kind: "nearby", base: "dubai", silent: false });
  });

  // D-6: the page prints clock times, so silence also needs a longitude cap.
  it("breaks silence past 5 deg of longitude even at identical latitude", () => {
    expect(target(ICELAND_LON4)).toMatchObject({ kind: "nearby", base: "reikiavik", silent: true });
    expect(target(ICELAND_LON6)).toMatchObject({ kind: "nearby", base: "reikiavik", silent: false });
  });
});

describe("directoryTarget — rule 3: offer with the km printed", () => {
  it("offers Rome to Naples, 1.05 deg away", () => {
    expect(target(NAPLES)).toMatchObject({ kind: "nearby", base: "roma", silent: false });
    expect(Math.round((target(NAPLES) as { km: number }).km)).toBe(188);
  });

  it("offers Madrid to Bilbao, just inside the 3 deg cap", () => {
    expect(target(BILBAO)).toMatchObject({ kind: "nearby", base: "madrid", silent: false });
    expect(Math.round((target(BILBAO) as { km: number }).km)).toBe(323);
  });

  // §4.4: the {km} the chip prints comes from the shared haversine, and it must be
  // the distance to the page actually linked — not to some other candidate.
  it("carries the true great-circle distance to the destination it names", () => {
    for (const p of [NAPLES, BILBAO, ICELAND_LON6, TEMPERATE_GULF, GETAFE, TOLEDO]) {
      const hit = target(p) as { kind: string; base: string; km: number };
      expect(hit.kind).toBe("nearby");
      const dest = BUILTIN_CITIES.find((c) => c.id === `builtin:${hit.base}`)!;
      expect(dest).toBeTruthy();
      expect(hit.km).toBeCloseTo(haversineKm(p.lat, p.lon, dest.lat, dest.lon), 9);
      expect(hit.km).toBeCloseTo(nearestBuiltin(p.lat, p.lon)!.km, 9);
    }
  });

  it("still offers at 1488 km when the latitude matches", () => {
    expect(target(ICELAND_1488)).toMatchObject({ kind: "nearby", base: "reikiavik", silent: false });
  });
});

describe("directoryTarget — rule 4: the index, never nothing", () => {
  // D-9 + verification contract §8.1. Today this is the 54 % of searchable cities for
  // which the chip silently vanishes.
  it("falls back to the index past 3 deg of latitude", () => {
    expect(target(SANTANDER)).toEqual({ kind: "index" });
  });

  it("falls back to the index past 1500 km even at identical latitude", () => {
    expect(target(ICELAND_1582)).toEqual({ kind: "index" });
  });

  it("falls back to the index for the places that have nothing near them", () => {
    expect(target(USHUAIA)).toEqual({ kind: "index" });
    expect(target(MID_PACIFIC)).toEqual({ kind: "index" });
    expect(target(SOUTH_POLE)).toEqual({ kind: "index" });
  });

  it("never returns null or undefined for any finite coordinate", () => {
    const probes = [
      MADRID, GETAFE, TOLEDO, SALAMANCA, NAPLES, BILBAO, SANTANDER, SURAT,
      TROPICAL_GULF, TEMPERATE_GULF, ICELAND_LON4, ICELAND_LON6, ICELAND_1488,
      ICELAND_1582, USHUAIA, MID_PACIFIC, SOUTH_POLE,
      { lat: 89.9, lon: 0 }, { lat: -89.9, lon: 179.9 }, { lat: 0, lon: 0 },
    ];
    for (const p of probes) {
      const hit = target(p);
      expect(hit).toBeTruthy();
      expect(["exact", "nearby", "index"]).toContain(hit.kind);
    }
  });

  it("resolves the index branch to a real path in every locale", () => {
    for (const locale of ["es", "en", "fr", "de", "ru", "lt"]) {
      expect(indexPath(locale)).toMatch(/^\/[a-z-]+$/);
    }
  });

  it("resolves every non-index branch to a real city path", () => {
    for (const p of [MADRID, GETAFE, TOLEDO, NAPLES, BILBAO, SURAT, ICELAND_LON6]) {
      const hit = target(p) as { kind: string; base?: string };
      expect(cityPagePath(hit.base!, "en")).toBeTruthy();
    }
  });
});

describe("the 400 km rule is gone", () => {
  // §4.1 replaces targetCityBase outright; leaving it exported would leave a second,
  // silent answer to the same question in the codebase.
  it("no longer exports targetCityBase", () => {
    expect((links as Record<string, unknown>).targetCityBase).toBeUndefined();
  });
});
