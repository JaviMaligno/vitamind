import { describe, it, expect } from "vitest";
import { BUILTIN_CITIES } from "@/lib/cities";
import { monthDirection, DRIFT_MIN_DEG } from "@/lib/sun-copy";
import { compassPoint, offsetFromDueEast } from "@/lib/compass";
import { sunDirection, doyFromMonthDay, daysInMonth } from "@/lib/solar";
import { getSunTimes } from "@/lib/sun-times";

/**
 * `monthDirection` is what the month page's direction copy states, so every
 * figure it returns is a claim that ships in six languages on 2880 pages. The
 * figures are checked against `lib/solar.ts` — the module that computes them —
 * and never against a number typed into this file, except where a number is the
 * point being made (the labels, and the two hemispheres in June).
 */

const city = (slug: string) => {
  const c = BUILTIN_CITIES.find((x) => x.id === `builtin:${slug}`);
  if (!c) throw new Error(`fixture city missing: ${slug}`);
  return c;
};

const dirFor = (slug: string, monthIndex: number) => monthDirection(city(slug).lat, monthIndex);

describe("monthDirection anchors on the 15th, like every other mid-month figure", () => {
  it("takes both bearings from sunDirection on day 15, rounded", () => {
    for (const [slug, m] of [["madrid", 7], ["sidney", 5], ["singapur", 0], ["reikiavik", 5]] as const) {
      const raw = sunDirection(city(slug).lat, doyFromMonthDay(m, 15))!;
      const d = dirFor(slug, m)!;
      expect(d.sunriseBearing, `${slug}/${m}`).toBe(Math.round(raw.sunriseBearing) % 360);
      expect(d.sunsetBearing, `${slug}/${m}`).toBe(Math.round(raw.sunsetBearing) % 360);
      expect(d.sunrisePoint, `${slug}/${m}`).toBe(compassPoint(raw.sunriseBearing));
      expect(d.sunsetPoint, `${slug}/${m}`).toBe(compassPoint(raw.sunsetBearing));
      expect({ degrees: d.offDegrees, side: d.offSide }, `${slug}/${m}`)
        .toEqual(offsetFromDueEast(raw.sunriseBearing));
    }
  });
});

describe("monthDirection names the sector the reader can point at", () => {
  it("puts the Madrid August sunset in the west, north of due west", () => {
    const d = dirFor("madrid", 7)!;
    expect(d.sunsetPoint).toBe("w");
    expect(d.sunrisePoint).toBe("e");
    expect(d.offSide).toBe("north");
    // The label is a 45deg sector; the offset is what makes it specific.
    expect(d.offDegrees).toBe(19);
  });

  it("puts the Madrid December sunrise in the southeast", () => {
    const d = dirFor("madrid", 11)!;
    expect(d.sunrisePoint).toBe("se");
    expect(d.sunsetPoint).toBe("sw");
    expect(d.offSide).toBe("south");
  });

  it("puts the June sunrise northeast in BOTH hemispheres", () => {
    // Not mirrored: the bearing divides by cos(latitude), which is even, so in
    // June the sun rises north of east everywhere it rises. Sydney included —
    // which is why its winter sun crosses the northern sky.
    expect(dirFor("madrid", 5)!.sunrisePoint).toBe("ne");
    expect(dirFor("sidney", 5)!.sunrisePoint).toBe("ne");
    expect(dirFor("madrid", 5)!.offSide).toBe("north");
    expect(dirFor("sidney", 5)!.offSide).toBe("north");
  });

  it("puts the Reykjavik June sun up and down in the north", () => {
    // 64.15 N in June: 70deg off due east, which lands both ends in the north
    // sector. The pair is what the copy says, so both are pinned.
    const d = dirFor("reikiavik", 5)!;
    expect(d.sunrisePoint).toBe("n");
    expect(d.sunsetPoint).toBe("n");
    expect(d.offDegrees).toBe(70);
  });
});

describe("monthDirection reports the drift across the month", () => {
  it("takes the drift from day 1 to the last day, not from the mid-month figure", () => {
    for (const [slug, m] of [["madrid", 7], ["reikiavik", 7], ["singapur", 0]] as const) {
      const lat = city(slug).lat;
      const last = daysInMonth(m);
      const raw =
        sunDirection(lat, doyFromMonthDay(m, last))!.sunriseBearing -
        sunDirection(lat, doyFromMonthDay(m, 1))!.sunriseBearing;
      const d = dirFor(slug, m)!;
      expect(d.driftDegrees, `${slug}/${m}`).toBe(Math.round(Math.abs(raw)));
      // A FALLING sunrise bearing walks from the east toward the north.
      expect(d.drift, `${slug}/${m}`).toBe(raw < 0 ? "north" : "south");
    }
  });

  it("walks the sunrise point south through August and north through January", () => {
    expect(dirFor("madrid", 7)!.drift).toBe("south");
    expect(dirFor("madrid", 7)!.driftDegrees).toBe(13);
    expect(dirFor("madrid", 0)!.drift).toBe("north");
  });

  it("says the points barely move when the drift is under the model's own error", () => {
    // `lib/solar.ts` documents `declination` as worth "~1-2deg of bearing", so a
    // one-degree shift across a solstice month is not a direction this model can
    // claim. December in Madrid drifts 1deg; the copy says "barely moves".
    const d = dirFor("madrid", 11)!;
    expect(d.driftDegrees).toBeLessThan(DRIFT_MIN_DEG);
    expect(d.drift).toBe("none");
  });
});

describe("monthDirection withholds an answer it cannot give", () => {
  it("returns null for every polar month in Tromso", () => {
    expect(dirFor("tromso", 5)).toBeNull();
    expect(dirFor("tromso", 11)).toBeNull();
    expect(dirFor("tromso", 0)).toBeNull();
  });

  it("still answers for Tromso in August, when the sun does rise and set", () => {
    expect(dirFor("tromso", 7)).not.toBeNull();
  });

  it("still answers for Reykjavik in June, south of the Arctic Circle", () => {
    // A blanket "high latitude -> no answer" would withhold the direction from a
    // city that is already shipped and does have one.
    expect(dirFor("reikiavik", 5)).not.toBeNull();
  });

  it("returns null for a month with even one polar day, not just an all-polar one", () => {
    // 66 N: the sun stops setting partway through June (18 of the 30 days), so
    // the month has no one answer — the same rule `sunRegime` applies to the
    // whole page. Tromso's July is the same shape at a latitude already named
    // as pending in `lib/sun-routes.ts`.
    const partial = Array.from({ length: daysInMonth(5) }, (_, i) =>
      sunDirection(66, doyFromMonthDay(5, i + 1)),
    );
    expect(partial.some((x) => x === null)).toBe(true);
    expect(partial.some((x) => x !== null)).toBe(true);
    expect(monthDirection(66, 5)).toBeNull();
    expect(monthDirection(69.65, 6)).toBeNull();
  });

  /**
   * The page must never print a sunrise TIME with no direction beside it, nor a
   * direction on a month whose table prints em dashes. `getSunTimes` decides the
   * first and `monthDirection` the second, so they are swept against each other
   * rather than assumed to agree.
   */
  it("is null exactly when the month has a day without a sunrise time", () => {
    for (let lat = -89; lat <= 89; lat += 2) {
      for (let m = 0; m < 12; m++) {
        const noSunrise = Array.from({ length: daysInMonth(m) }, (_, i) =>
          getSunTimes(lat, 0, new Date(Date.UTC(2026, m, i + 1))).sunrise,
        ).some((h) => h === null);
        expect(monthDirection(lat, m) === null, `lat ${lat} month ${m}`).toBe(noSunrise);
      }
    }
  });
});

describe("monthDirection never hands the copy a figure it cannot render", () => {
  it("keeps every bearing inside the circle and every offset inside a quadrant", () => {
    for (let lat = -89; lat <= 89; lat += 1) {
      for (let m = 0; m < 12; m++) {
        const d = monthDirection(lat, m);
        if (!d) continue;
        const where = `lat ${lat} month ${m}`;
        expect(Number.isFinite(d.sunriseBearing), where).toBe(true);
        expect(d.sunriseBearing, where).toBeGreaterThanOrEqual(0);
        expect(d.sunriseBearing, where).toBeLessThan(360);
        expect(d.sunsetBearing, where).toBeGreaterThanOrEqual(0);
        expect(d.sunsetBearing, where).toBeLessThan(360);
        // A sunrise is always in the eastern half of the circle, a sunset in
        // the western half, at every latitude and on every day.
        expect(d.sunriseBearing, where).toBeLessThanOrEqual(180);
        expect(d.sunsetBearing, where).toBeGreaterThanOrEqual(180);
        expect(d.offDegrees, where).toBeLessThanOrEqual(90);
        expect(d.driftDegrees, where).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
