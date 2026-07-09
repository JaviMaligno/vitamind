import { describe, it, expect } from "vitest";
import { estimateUVFromElevation, MIN_UVI_ELEVATION, computeExposureFromCurve, MIN_UVI } from "@/lib/vitd";
import { uvIndex, minElevationForUVI, OZONE_REFERENCE_DU } from "@/lib/uv-model";

describe("estimateUVFromElevation", () => {
  it("delegates to the Madronich model", () => {
    expect(estimateUVFromElevation(45)).toBeCloseTo(uvIndex(45), 10);
    expect(estimateUVFromElevation(45, { ozoneDu: 400 })).toBeCloseTo(uvIndex(45, 400), 10);
    expect(estimateUVFromElevation(45, { ozoneDu: 300, elevationM: 2640 })).toBeCloseTo(uvIndex(45, 300, 2640), 10);
  });

  it("is zero at or below the horizon", () => {
    expect(estimateUVFromElevation(0)).toBe(0);
    expect(estimateUVFromElevation(-5)).toBe(0);
  });

  it("no longer overestimates at low sun", () => {
    // The old model returned 2.98 here, which is why Boston appeared to have no winter.
    expect(estimateUVFromElevation(20)).toBeLessThan(1.2);
  });
});

describe("MIN_UVI_ELEVATION", () => {
  it("is the sea-level, reference-ozone threshold", () => {
    expect(MIN_UVI_ELEVATION).toBeCloseTo(minElevationForUVI(MIN_UVI, OZONE_REFERENCE_DU, 0), 10);
    expect(MIN_UVI_ELEVATION).toBeCloseTo(33.68, 1);
  });

  it("is far above the old, wrong value of 20.14 degrees", () => {
    expect(MIN_UVI_ELEVATION).toBeGreaterThan(30);
  });
});

describe("computeExposureFromCurve", () => {
  const curve = Array.from({ length: 24 }, (_, h) => ({
    localHours: h,
    elevation: h >= 6 && h <= 18 ? 60 - Math.abs(12 - h) * 6 : -10,
  }));

  it("needs fewer minutes at altitude, where there is more UV", () => {
    const sea = computeExposureFromCurve(curve as never, 3, 0.25, 1000, null, { elevationM: 0 });
    const high = computeExposureFromCurve(curve as never, 3, 0.25, 1000, null, { elevationM: 2640 });
    expect(sea).not.toBeNull();
    expect(high).not.toBeNull();
    expect(high!.bestUVI).toBeGreaterThan(sea!.bestUVI);
    expect(high!.minutesNeeded).toBeLessThan(sea!.minutesNeeded);
  });

  it("needs more minutes under a thicker ozone column", () => {
    const thin = computeExposureFromCurve(curve as never, 3, 0.25, 1000, null, { ozoneDu: 250 });
    const thick = computeExposureFromCurve(curve as never, 3, 0.25, 1000, null, { ozoneDu: 400 });
    expect(thick!.minutesNeeded).toBeGreaterThan(thin!.minutesNeeded);
  });

  it("returns null when the sun never clears the threshold", () => {
    const night = Array.from({ length: 24 }, (_, h) => ({ localHours: h, elevation: 5 }));
    expect(computeExposureFromCurve(night as never, 3, 0.25)).toBeNull();
  });
});
