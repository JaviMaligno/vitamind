import { describe, it, expect } from "vitest";
import {
  ozoneDU, uvIndex, minElevationForUVI, synthesisThresholdElevation,
  OZONE_REFERENCE_DU, UVI_SYNTHESIS_THRESHOLD, UVI_ALTITUDE_GAIN_PER_KM,
} from "@/lib/uv-model";

// Reference values produced by the van Heuklon (1979) closed form at lon = 0.
describe("ozoneDU (van Heuklon 1979)", () => {
  it("is flat at the equator", () => {
    for (const doy of [15, 105, 196, 288]) {
      expect(ozoneDU(0, 0, doy)).toBeCloseTo(235, 0);
    }
  });

  it("peaks in northern spring at mid and high latitudes", () => {
    expect(ozoneDU(40, 0, 15)).toBeCloseTo(320, 0);   // January
    expect(ozoneDU(40, 0, 105)).toBeCloseTo(349, 0);  // April  (max)
    expect(ozoneDU(40, 0, 288)).toBeCloseTo(303, 0);  // October (min)
    expect(ozoneDU(65, 0, 105)).toBeCloseTo(421, 0);
  });

  it("phase-flips in the southern hemisphere", () => {
    // Southern max is in southern spring (Oct), not April.
    expect(ozoneDU(-35, 0, 105)).toBeLessThan(ozoneDU(-35, 0, 288));
    expect(ozoneDU(-35, 0, 288)).toBeCloseTo(310, 0);
  });

  it("never leaves the [235, 445] DU band anywhere on Earth", () => {
    let min = Infinity, max = -Infinity;
    for (let lat = -90; lat <= 90; lat += 1) {
      for (let lon = -180; lon <= 180; lon += 30) {
        for (let doy = 1; doy <= 365; doy += 5) {
          const o3 = ozoneDU(lat, lon, doy);
          if (o3 < min) min = o3;
          if (o3 > max) max = o3;
        }
      }
    }
    expect(min).toBeCloseTo(235, 1);   // the equator, where sin^2(B*lat) = 0
    expect(max).toBeLessThanOrEqual(445);
  });
});

describe("uvIndex (Madronich 2007)", () => {
  it("is zero at or below the horizon", () => {
    expect(uvIndex(0)).toBe(0);
    expect(uvIndex(-10)).toBe(0);
  });

  it("reaches 12.5 at the zenith with reference ozone", () => {
    expect(uvIndex(90, OZONE_REFERENCE_DU)).toBeCloseTo(12.5, 1);
  });

  it("matches the published curve at reference ozone", () => {
    expect(uvIndex(20, 300)).toBeCloseTo(0.93, 1);
    expect(uvIndex(30, 300)).toBeCloseTo(2.34, 1);
    expect(uvIndex(45, 300)).toBeCloseTo(5.4, 1);
  });

  it("falls as ozone rises", () => {
    expect(uvIndex(45, 400)).toBeLessThan(uvIndex(45, 300));
    expect(uvIndex(45, 250)).toBeGreaterThan(uvIndex(45, 300));
  });

  it("increases monotonically with solar elevation", () => {
    for (let e = 1; e < 90; e += 1) {
      expect(uvIndex(e + 1, 300)).toBeGreaterThan(uvIndex(e, 300));
    }
  });

  it("never returns a negative UV index, even for a nonsensical elevation", () => {
    // Amsterdam (-2 m) is the real lower bound and must still work normally.
    expect(uvIndex(45, 300, -2)).toBeGreaterThan(0);
    expect(uvIndex(45, 300, -2)).toBeLessThan(uvIndex(45, 300, 0));
    // A bad geocode below -12.5 km would flip the gain factor negative.
    expect(uvIndex(45, 300, -20000)).toBe(0);
    expect(Number.isNaN(uvIndex(45, 300, -20000))).toBe(false);
  });

  it("applies the altitude gain of 8% per km", () => {
    const sea = uvIndex(45, 300, 0);
    expect(uvIndex(45, 300, 1000)).toBeCloseTo(sea * (1 + UVI_ALTITUDE_GAIN_PER_KM), 5);
    // Bogota, 2640 m -> about +21%
    expect(uvIndex(45, 300, 2640) / sea).toBeCloseTo(1.2112, 3);
  });
});

describe("minElevationForUVI", () => {
  // The UVI=3 threshold moves by ~10 degrees across the plausible ozone range.
  // This is why a single MIN_UVI_ELEVATION constant cannot be correct.
  it("inverts the model at reference ozone", () => {
    expect(minElevationForUVI(3, 300, 0)).toBeCloseTo(33.7, 1);
  });

  it("tracks ozone", () => {
    expect(minElevationForUVI(3, 250, 0)).toBeCloseTo(30.4, 1);
    expect(minElevationForUVI(3, 350, 0)).toBeCloseTo(36.8, 1);
    expect(minElevationForUVI(3, 400, 0)).toBeCloseTo(39.9, 1);
  });

  it("lowers the required elevation at altitude", () => {
    expect(minElevationForUVI(3, 300, 2640)).toBeLessThan(minElevationForUVI(3, 300, 0));
  });

  it("round-trips against uvIndex", () => {
    for (const o3 of [250, 300, 350, 400]) {
      for (const alt of [0, 1600, 2640]) {
        const e = minElevationForUVI(3, o3, alt);
        expect(uvIndex(e, o3, alt)).toBeCloseTo(3, 3);
      }
    }
  });

  // Madronich states validity for SZA <= 60 deg, i.e. elevation >= 30 deg.
  // Where the threshold actually BINDS -- mid and high latitudes, ozone 300-445 DU --
  // it lands inside that window.
  it("stays inside Madronich's validity range wherever it binds", () => {
    for (const o3 of [300, 350, 400, 445]) {
      expect(minElevationForUVI(3, o3, 0)).toBeGreaterThanOrEqual(30);
      expect(minElevationForUVI(3, o3, 0)).toBeLessThanOrEqual(45);
    }
  });

  // At van Heuklon's global minimum ozone (235 DU, reached only at the equator) the
  // threshold dips just below Madronich's 30 deg floor. This is a real extrapolation,
  // but it never decides anything: equatorial noon sun never falls below 66.6 deg.
  // Pinned so that a future change to the ozone model surfaces here.
  it("dips below the validity floor only at equatorial ozone, where it never binds", () => {
    expect(minElevationForUVI(3, 235, 0)).toBeCloseTo(29.33, 1);
    expect(minElevationForUVI(3, 250, 0)).toBeCloseTo(30.36, 1);
  });
});

describe("synthesisThresholdElevation", () => {
  it("uses the day's ozone at the given place", () => {
    const lat = 42.36, lon = -71.06; // Boston
    const summer = synthesisThresholdElevation(lat, lon, 172, 0);
    const autumn = synthesisThresholdElevation(lat, lon, 288, 0);
    // October ozone is lower than June ozone at 42N, so the bar is lower in October.
    expect(autumn).toBeLessThan(summer);
  });

  it("agrees with minElevationForUVI for the same ozone", () => {
    const lat = 40, lon = 0, doy = 105;
    expect(synthesisThresholdElevation(lat, lon, doy, 0)).toBeCloseTo(
      minElevationForUVI(UVI_SYNTHESIS_THRESHOLD, ozoneDU(lat, lon, doy), 0),
      6,
    );
  });

  it("lowers the bar for a high-altitude city", () => {
    // Bogota at 2640 m needs less solar elevation than the same spot at sea level.
    expect(synthesisThresholdElevation(4.71, -74.07, 172, 2640)).toBeLessThan(
      synthesisThresholdElevation(4.71, -74.07, 172, 0),
    );
  });
});
