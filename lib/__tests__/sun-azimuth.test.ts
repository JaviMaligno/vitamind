import { describe, it, expect } from "vitest";
import { sunDirection, HORIZON_DEG, declination, solarElev, equationOfTime, dateFromDoy } from "../solar";
import { getSunTimes } from "../sun-times";

const RAD = Math.PI / 180;

/** Day number of the March equinox in this model: `declination(81)` is exactly 0. */
const MODEL_EQUINOX_DOY = 81;
const JUNE_SOLSTICE_DOY = 172;
const DECEMBER_SOLSTICE_DOY = 355;

const MADRID_LAT = 40.4168;
const SYDNEY_LAT = -33.87;
/** The latitude `lib/cities.ts` ships for `builtin:reikiavik`, not a rounded one. */
const REYKJAVIK_LAT = 64.15;
/** Named in `lib/sun-routes.ts` as a pending city; north of the Arctic Circle. */
const TROMSO_LAT = 69.65;
const SVALBARD_LAT = 78.22;

/**
 * The sunrise bearing derived a second way, for the tests only.
 *
 * `sunDirection` goes through the hour angle: it solves the horizon crossing for
 * H and reads the bearing off the sun's horizon-frame vector with `atan2`. This
 * helper never computes H at all — it applies the cosine rule to the other angle
 * of the same pole/zenith/sun triangle, `sin d = sin h sin lat + cos h cos lat
 * cos A`, and inverts it. Two different unknowns solved from two different
 * equations, so agreement between them is evidence about the maths rather than
 * evidence that one expression was typed out twice.
 *
 * Returns the MORNING bearing (0-180): `acos` cannot tell the two crossings
 * apart, and the caller supplies the half of the day.
 */
function morningBearingByCosineRule(lat: number, doy: number, elevDeg: number): number {
  const d = declination(doy) * RAD;
  const lr = lat * RAD;
  const hr = elevDeg * RAD;
  const cosA = (Math.sin(d) - Math.sin(hr) * Math.sin(lr)) / (Math.cos(hr) * Math.cos(lr));
  return Math.acos(cosA) / RAD;
}

describe("sunDirection — the equinox identity", () => {
  it("puts sunrise exactly due east and sunset exactly due west at every latitude, at the geometric horizon", () => {
    // Exact, and it needs no fixture: with declination 0 the sun's diurnal path
    // IS the celestial equator, which meets the horizon at east and west at
    // every latitude. `declination(81)` returns a hard zero (sin(0)), so this is
    // an equality check, not an approximation.
    //
    // It holds at elevation 0 only. The elevation argument exists so this test
    // can ask for the geometric horizon; the default is the refracted one the
    // rest of the site rises and sets by, tested separately below.
    expect(declination(MODEL_EQUINOX_DOY)).toBe(0);
    for (let lat = -70; lat <= 70; lat += 5) {
      const dir = sunDirection(lat, MODEL_EQUINOX_DOY, 0);
      expect(dir).not.toBeNull();
      expect(dir!.sunriseBearing).toBeCloseTo(90, 9);
      expect(dir!.sunsetBearing).toBeCloseTo(270, 9);
    }
  });

  it("puts the equinox sunrise a fraction of a degree north of east at the refracted horizon", () => {
    // The default elevation is -0.833 (refraction + semidiameter), i.e. the sun
    // is still below the geometric horizon when this site calls it risen. On the
    // equinox that instant is slightly earlier than the due-east crossing, and
    // in the northern hemisphere earlier means further north. Under a degree at
    // Madrid, so it changes no compass label — but the equinox check above is
    // exact only at elevation 0, and pretending otherwise is the failure mode.
    const dir = sunDirection(MADRID_LAT, MODEL_EQUINOX_DOY)!;
    expect(dir.sunriseBearing).toBeLessThan(90);
    expect(90 - dir.sunriseBearing).toBeGreaterThan(0.5);
    expect(90 - dir.sunriseBearing).toBeLessThan(1);
  });
});

describe("sunDirection — season", () => {
  it("rises north of east in June and south of east in December, in BOTH hemispheres", () => {
    // Not a hemisphere mirror. The bearing depends on the declination and on
    // cos(latitude), which is even, so the sign of the offset from due east is
    // the season's alone: in June the sun rises north of east everywhere it
    // rises, Sydney included — which is why the Australian winter sun crosses
    // the NORTHERN sky. What the hemispheres do mirror is which of those months
    // is summer, not where the sun comes up.
    for (const lat of [MADRID_LAT, SYDNEY_LAT]) {
      expect(sunDirection(lat, JUNE_SOLSTICE_DOY)!.sunriseBearing).toBeLessThan(90);
      expect(sunDirection(lat, DECEMBER_SOLSTICE_DOY)!.sunriseBearing).toBeGreaterThan(90);
      expect(sunDirection(lat, JUNE_SOLSTICE_DOY)!.sunsetBearing).toBeGreaterThan(270);
      expect(sunDirection(lat, DECEMBER_SOLSTICE_DOY)!.sunsetBearing).toBeLessThan(270);
    }
  });

  it("swings further from east at higher latitude on the same day", () => {
    // cos(latitude) in the denominator: the same declination buys a bigger
    // offset the further from the equator you stand.
    const lats = [0, 20, MADRID_LAT, REYKJAVIK_LAT];
    const offsets = lats.map((lat) => 90 - sunDirection(lat, JUNE_SOLSTICE_DOY)!.sunriseBearing);
    for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
  });

  it("drifts south across August in Madrid, by about 13 degrees", () => {
    // The shape of the claim the month pages are for: within one month the
    // sunset moves, and by enough to be worth a sentence.
    const aug1 = sunDirection(MADRID_LAT, 213)!;
    const aug31 = sunDirection(MADRID_LAT, 243)!;
    expect(aug31.sunsetBearing).toBeLessThan(aug1.sunsetBearing);
    expect(aug1.sunsetBearing - aug31.sunsetBearing).toBeGreaterThan(11);
    expect(aug1.sunsetBearing - aug31.sunsetBearing).toBeLessThan(15);
  });
});

describe("sunDirection — cross-checks against independent derivations", () => {
  it("matches the cosine rule for the bearing at a given elevation, across latitudes and seasons", () => {
    for (let lat = -65; lat <= 65; lat += 5) {
      for (const doy of [1, 46, 81, 110, 172, 213, 243, 264, 300, 355]) {
        for (const elev of [0, HORIZON_DEG]) {
          const dir = sunDirection(lat, doy, elev);
          expect(dir).not.toBeNull();
          expect(dir!.sunriseBearing).toBeCloseTo(morningBearingByCosineRule(lat, doy, elev), 8);
        }
      }
    }
  });

  it("matches cos(A) = sin(declination) / cos(latitude) at the geometric horizon", () => {
    // The reduced form of the same rule when h is 0. Spelled out separately
    // because it is the relation quoted for this feature, and it drops the
    // elevation terms entirely.
    for (const lat of [0, MADRID_LAT, SYDNEY_LAT, REYKJAVIK_LAT]) {
      for (const doy of [1, 81, 172, 213, 264, 355]) {
        const expected = Math.acos(Math.sin(declination(doy) * RAD) / Math.cos(lat * RAD)) / RAD;
        expect(sunDirection(lat, doy, 0)!.sunriseBearing).toBeCloseTo(expected, 8);
      }
    }
  });

  it("is symmetric about the north-south axis: sunset = 360 - sunrise", () => {
    // Weaker evidence than it looks, and worth saying so: both bearings come
    // out of one hour angle differing only in sign, so symmetry is structural
    // rather than discovered. It still catches a returned duplicate or a
    // dropped sign. It is also only true of THIS model, whose declination is
    // one value per day; the real declination moves ~0.4 deg/day, so a real
    // sunset is off its morning mirror by a few tenths of a degree.
    for (const lat of [MADRID_LAT, SYDNEY_LAT, REYKJAVIK_LAT]) {
      for (const doy of [1, 81, 172, 243, 355]) {
        const dir = sunDirection(lat, doy)!;
        expect(dir.sunsetBearing).toBeCloseTo(360 - dir.sunriseBearing, 10);
      }
    }
  });

  it("describes the instant that getSunTimes prints as sunrise", () => {
    // End to end across three modules, which is the claim the copy will make:
    // the bearing belongs to the moment the table says the sun comes up. Take
    // that time from `getSunTimes`, ask `solarElev` how high the sun is then,
    // and feed that elevation to the independent cosine rule.
    //
    // Longitude 0 with a zero offset so the returned local hours ARE UTC hours;
    // this test is about the geometry, not about zone conversion.
    for (const lat of [MADRID_LAT, SYDNEY_LAT, REYKJAVIK_LAT]) {
      for (const doy of [46, 172, 213, 355]) {
        const st = getSunTimes(lat, 0, dateFromDoy(doy), undefined, 0);
        expect(st.sunrise).not.toBeNull();
        const elevAtSunrise = solarElev(lat, 0, doy, st.sunrise!);
        expect(elevAtSunrise).toBeCloseTo(HORIZON_DEG, 6);
        expect(sunDirection(lat, doy)!.sunriseBearing)
          .toBeCloseTo(morningBearingByCosineRule(lat, doy, elevAtSunrise), 6);
        // The morning half of the day, not the evening one: solar noon comes later.
        const solarNoon = 12 - equationOfTime(doy) / 60;
        expect(st.sunrise!).toBeLessThan(solarNoon);
      }
    }
  });
});

describe("sunDirection — no sunrise to point at", () => {
  it("returns null through the polar day and the polar night", () => {
    expect(sunDirection(TROMSO_LAT, JUNE_SOLSTICE_DOY)).toBeNull();
    expect(sunDirection(TROMSO_LAT, DECEMBER_SOLSTICE_DOY)).toBeNull();
    expect(sunDirection(SVALBARD_LAT, JUNE_SOLSTICE_DOY)).toBeNull();
    expect(sunDirection(SVALBARD_LAT, DECEMBER_SOLSTICE_DOY)).toBeNull();
    expect(sunDirection(-SVALBARD_LAT, JUNE_SOLSTICE_DOY)).toBeNull();
    expect(sunDirection(-SVALBARD_LAT, DECEMBER_SOLSTICE_DOY)).toBeNull();
  });

  it("still answers for Reykjavik in June, which never quite loses its sunrise", () => {
    // 64.13 N is south of the Arctic Circle, so the sun sets even at the
    // solstice. The page for Reykjavik in June therefore needs a direction,
    // and a blanket "high latitude means null" would have withheld it.
    const dir = sunDirection(REYKJAVIK_LAT, JUNE_SOLSTICE_DOY);
    expect(dir).not.toBeNull();
    expect(dir!.sunriseBearing).toBeGreaterThan(0);
    expect(dir!.sunriseBearing).toBeLessThan(45);
  });

  it("returns null at the poles, where cos(latitude) collapses", () => {
    for (const doy of [1, 81, 172, 355]) {
      expect(sunDirection(90, doy)).toBeNull();
      expect(sunDirection(-90, doy)).toBeNull();
    }
  });

  it("has a direction exactly when getSunTimes has a sunrise, over a latitude sweep", () => {
    // The failure this rules out is a page printing a time with no direction,
    // or a direction on a day with no sunrise. Both modules must draw the polar
    // boundary at the same place, including on the days that straddle it.
    for (let lat = -89; lat <= 89; lat += 1) {
      for (const doy of [1, 46, 81, 110, 172, 213, 243, 264, 300, 355]) {
        const hasSunrise = getSunTimes(lat, 0, dateFromDoy(doy), undefined, 0).sunrise !== null;
        expect(sunDirection(lat, doy) !== null).toBe(hasSunrise);
      }
    }
  });

  it("keeps sunrise in the eastern half and sunset in the western half, always", () => {
    // The invariant `sunDirection` relies on instead of a defensive wrap: a
    // sunrise bearing is in (0, 180) and a sunset in (180, 360) for every
    // latitude and day that has one. If this ever fails, the missing wrap in
    // `solar.ts` is the thing to reach for.
    for (let lat = -89; lat <= 89; lat += 1) {
      for (let doy = 1; doy <= 365; doy += 7) {
        const dir = sunDirection(lat, doy);
        if (dir === null) continue;
        expect(dir.sunriseBearing).toBeGreaterThan(0);
        expect(dir.sunriseBearing).toBeLessThan(180);
        expect(dir.sunsetBearing).toBeGreaterThan(180);
        expect(dir.sunsetBearing).toBeLessThan(360);
      }
    }
  });
});
