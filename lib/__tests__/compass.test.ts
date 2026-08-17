import { describe, it, expect } from "vitest";
import { COMPASS_POINTS, compassPoint, offsetFromDueEast } from "@/lib/compass";
import { sunDirection, HORIZON_DEG, doyFromMonthDay } from "@/lib/solar";

/**
 * The compass label is the part of the answer a reader can act on without an
 * instrument, so it has to be right at the seams: at a sector edge, at the wrap
 * through north, and against the one solar identity that needs no fixture.
 *
 * GRANULARITY IS 8 POINTS, and that is the decision these tests pin. The
 * bearing itself ships beside the label, so the label is not carrying the
 * precision — it is carrying the pointability. `lib/solar.ts` documents
 * `declination` as the one-term approximation, worth "~1-2° of bearing" (more
 * the further from the equator): a 16-point sector is 22.5° wide, an 8-point
 * sector 45°, so the finer label sits within one error width of a boundary
 * exactly twice as often, in exchange for names ("west-northwest",
 * "oeste-noroeste", "šiaurės šiaurės vakarai") that nobody says out loud in any
 * of the six locales this ships in.
 */

describe("compassPoint", () => {
  it("names the four cardinal bearings", () => {
    expect(compassPoint(0)).toBe("n");
    expect(compassPoint(90)).toBe("e");
    expect(compassPoint(180)).toBe("s");
    expect(compassPoint(270)).toBe("w");
  });

  it("names the four intercardinal bearings", () => {
    expect(compassPoint(45)).toBe("ne");
    expect(compassPoint(135)).toBe("se");
    expect(compassPoint(225)).toBe("sw");
    expect(compassPoint(315)).toBe("nw");
  });

  it("puts every sector boundary in the clockwise sector", () => {
    // Boundaries sit at 22.5 + 45k. A bearing exactly on one belongs to the
    // sector it is entering, so the mapping is a partition with no bearing
    // belonging to two names.
    expect(compassPoint(22.5)).toBe("ne");
    expect(compassPoint(22.4)).toBe("n");
    expect(compassPoint(67.5)).toBe("e");
    expect(compassPoint(67.4)).toBe("ne");
    expect(compassPoint(292.5)).toBe("nw");
    expect(compassPoint(292.4)).toBe("w");
    expect(compassPoint(337.5)).toBe("n");
    expect(compassPoint(337.4)).toBe("nw");
  });

  it("wraps through north rather than falling off either end", () => {
    expect(compassPoint(360)).toBe("n");
    expect(compassPoint(359.9)).toBe("n");
    expect(compassPoint(-1)).toBe("n");
    expect(compassPoint(-90)).toBe("w");
    expect(compassPoint(720 + 90)).toBe("e");
  });

  it("returns one of the eight points for every degree of the circle", () => {
    for (let b = 0; b < 360; b += 0.25) {
      expect(COMPASS_POINTS, `bearing ${b}`).toContain(compassPoint(b));
    }
  });

  /**
   * The page prints the bearing rounded to a whole degree NEXT TO the label, so
   * "293° northwest" must never come out as "292° northwest" over a boundary at
   * 292.5. It cannot: every sector boundary is a half-degree, and `Math.round`
   * moves a value to the nearest integer without crossing the half-degree it
   * sits beside. Asserted rather than assumed, because the pairing of the two
   * is the whole point of shipping both.
   */
  it("agrees with the label the rounded bearing would get", () => {
    for (let b = 0; b < 360; b += 0.1) {
      const rounded = Math.round(b) % 360;
      expect(compassPoint(rounded), `bearing ${b}`).toBe(compassPoint(b));
    }
  });
});

describe("offsetFromDueEast", () => {
  it("reports zero and no side when the sun rises due east", () => {
    expect(offsetFromDueEast(90)).toEqual({ degrees: 0, side: "due" });
  });

  it("calls a bearing below 90 north of east and one above it south", () => {
    expect(offsetFromDueEast(58)).toEqual({ degrees: 32, side: "north" });
    expect(offsetFromDueEast(122)).toEqual({ degrees: 32, side: "south" });
  });

  it("collapses a sub-half-degree offset to due east rather than naming a side", () => {
    // "0° north of due east" is not a sentence anyone should read.
    expect(offsetFromDueEast(90.4)).toEqual({ degrees: 0, side: "due" });
    expect(offsetFromDueEast(89.6)).toEqual({ degrees: 0, side: "due" });
    expect(offsetFromDueEast(89.4)).toEqual({ degrees: 1, side: "north" });
  });
});

/**
 * The labels against the maths module, not against a table of my own making.
 */
describe("labels applied to sunDirection", () => {
  it("labels the equinox sunrise east and the sunset west at every latitude", () => {
    // `declination(81)` is a hard zero, so at the geometric horizon this is
    // exact — the strongest check available and the reason `sunDirection` takes
    // an elevation parameter at all.
    for (let lat = -80; lat <= 80; lat += 5) {
      const d = sunDirection(lat, 81, 0);
      expect(d, `lat ${lat}`).not.toBeNull();
      expect(compassPoint(d!.sunriseBearing), `lat ${lat}`).toBe("e");
      expect(compassPoint(d!.sunsetBearing), `lat ${lat}`).toBe("w");
      expect(offsetFromDueEast(d!.sunriseBearing).side, `lat ${lat}`).toBe("due");
    }
  });

  it("labels the June solstice sunrise northeast in BOTH hemispheres", () => {
    // Not a mirror. The bearing depends on declination and on cos(latitude),
    // which is even, so in June the sun rises north of east everywhere it rises
    // at all — which is why the Australian winter sun crosses the NORTHERN sky.
    const june = doyFromMonthDay(5, 21);
    for (const lat of [40.42, -33.87]) {
      const d = sunDirection(lat, june, HORIZON_DEG)!;
      expect(compassPoint(d.sunriseBearing), `lat ${lat}`).toBe("ne");
      expect(offsetFromDueEast(d.sunriseBearing).side, `lat ${lat}`).toBe("north");
    }
  });

  it("labels the December solstice sunrise southeast in both hemispheres", () => {
    const december = doyFromMonthDay(11, 21);
    for (const lat of [40.42, -33.87]) {
      const d = sunDirection(lat, december, HORIZON_DEG)!;
      expect(compassPoint(d.sunriseBearing), `lat ${lat}`).toBe("se");
      expect(offsetFromDueEast(d.sunriseBearing).side, `lat ${lat}`).toBe("south");
    }
  });

  it("gives sunrise and sunset labels that mirror about the north-south axis", () => {
    const mirror = { n: "n", ne: "nw", e: "w", se: "sw", s: "s", sw: "se", w: "e", nw: "ne" } as const;
    for (let lat = -60; lat <= 60; lat += 7.5) {
      for (const doy of [15, 81, 172, 264, 355]) {
        const d = sunDirection(lat, doy, HORIZON_DEG);
        if (!d) continue;
        expect(compassPoint(d.sunsetBearing), `lat ${lat} doy ${doy}`).toBe(
          mirror[compassPoint(d.sunriseBearing)],
        );
      }
    }
  });
});
