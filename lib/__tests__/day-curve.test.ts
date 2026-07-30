import { describe, it, expect } from "vitest";
import { sampleElevations, curvePath, viableBand, DAY_CURVE_STEP_MINUTES } from "../day-curve";
import type { SolarPoint } from "../types";

/** A synthetic day: a clean arc peaking at noon. */
const arc = (peak: number): SolarPoint[] =>
  Array.from({ length: 289 }, (_, i) => {
    const localHours = (i * 5) / 60;
    return { localHours, elevation: peak * Math.sin((Math.PI * localHours) / 24) - peak * 0.15 };
  });

describe("sampleElevations", () => {
  it("thins the 5-minute curve to one reading per step, endpoints included", () => {
    const sampled = sampleElevations(arc(60));
    // 24 h at 15-minute steps, inclusive of both midnights.
    expect(DAY_CURVE_STEP_MINUTES).toBe(15);
    expect(sampled).toHaveLength(97);
    expect(sampled[0]).toBeCloseTo(-9, 1);
    expect(sampled[48]).toBeCloseTo(51, 0); // noon, the peak
  });

  it("rounds to one decimal — the widget draws a 200px-tall chart, not a telescope", () => {
    for (const value of sampleElevations(arc(60))) {
      expect(value).toBe(Math.round(value * 10) / 10);
    }
  });

  it("survives a curve that is shorter than expected", () => {
    // A remote client cannot feed this, but a future caller might.
    expect(() => sampleElevations([{ localHours: 0, elevation: 1 }])).not.toThrow();
  });
});

describe("curvePath", () => {
  it("emits one move and then line segments over the plot box", () => {
    const path = curvePath([0, 10, 20, 10, 0], { width: 100, height: 50, min: -10, max: 30 });
    expect(path.startsWith("M")).toBe(true);
    expect(path.split("L")).toHaveLength(5); // one M + four L
  });

  it("maps the highest elevation nearest the top of the box", () => {
    const path = curvePath([0, 30], { width: 100, height: 50, min: 0, max: 30 });
    const [, second] = path.split(/[ML]/).filter(Boolean);
    const y = Number(second.split(",")[1]);
    expect(y).toBeCloseTo(0, 1);
  });
});

describe("viableBand", () => {
  it("spans the hours whose elevation clears the threshold", () => {
    // Steps of 15 min: indices 20..28 are 05:00..07:00.
    const elevations = Array.from({ length: 97 }, (_, i) => (i >= 20 && i <= 28 ? 40 : 0));
    const band = viableBand(elevations, 30);
    expect(band).toEqual({ startHours: 5, endHours: 7 });
  });

  it("returns null when nothing clears it — polar night, or a bad day", () => {
    expect(viableBand(Array.from({ length: 97 }, () => 5), 30)).toBeNull();
  });

  it("uses the outermost crossings, not the first gap", () => {
    // Clouds or numerical noise can dip the curve mid-window; the band is the
    // envelope, matching how the tool reports a single window.
    const elevations = Array.from({ length: 97 }, (_, i) =>
      i === 40 || i === 60 ? 40 : i === 50 ? 10 : 0);
    expect(viableBand(elevations, 30)).toEqual({ startHours: 10, endHours: 15 });
  });
});
