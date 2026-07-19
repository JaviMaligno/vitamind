import { describe, it, expect } from "vitest";
import { getSunTimes } from "../sun-times";

const MADRID = { lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid" };

describe("getSunTimes", () => {
  it("Madrid summer solstice: sunrise/sunset near ephemeris values", () => {
    // Reference (timeanddate): 2026-06-21 Madrid sunrise 06:44, sunset 21:49.
    const st = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 5, 21), MADRID.tz);
    expect(st.polar).toBeNull();
    expect(st.sunrise).toBeGreaterThan(6.74 - 0.25);
    expect(st.sunrise).toBeLessThan(6.74 + 0.25);
    expect(st.sunset).toBeGreaterThan(21.81 - 0.25);
    expect(st.sunset).toBeLessThan(21.81 + 0.25);
  });

  it("Madrid winter solstice: sunrise/sunset near ephemeris values", () => {
    // Reference: 2026-12-21 Madrid sunrise 08:35, sunset 17:51.
    const st = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 11, 21), MADRID.tz);
    expect(st.sunrise).toBeGreaterThan(8.58 - 0.25);
    expect(st.sunrise).toBeLessThan(8.58 + 0.25);
    expect(st.sunset).toBeGreaterThan(17.85 - 0.25);
    expect(st.sunset).toBeLessThan(17.85 + 0.25);
  });

  it("equator has ~12h days year round", () => {
    for (const month of [0, 3, 6, 9]) {
      const st = getSunTimes(-0.18, -78.47, new Date(2026, month, 15), undefined, -5);
      expect(Math.abs(st.dayLengthMin - 12 * 60)).toBeLessThan(20);
    }
  });

  it("polar day in Svalbard in June", () => {
    const st = getSunTimes(78.22, 15.65, new Date(2026, 5, 21), undefined, 2);
    expect(st.polar).toBe("day");
    expect(st.sunrise).toBeNull();
    expect(st.sunset).toBeNull();
    expect(st.dayLengthMin).toBe(1440);
  });

  it("polar night in Svalbard in December", () => {
    const st = getSunTimes(78.22, 15.65, new Date(2026, 11, 21), undefined, 1);
    expect(st.polar).toBe("night");
    expect(st.sunrise).toBeNull();
    expect(st.dayLengthMin).toBe(0);
  });

  it("days lengthen in February and shorten in November (northern hemisphere)", () => {
    const feb = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 1, 1), MADRID.tz);
    expect(feb.dayLengthDeltaMin).toBeGreaterThan(0);
    const nov = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 10, 1), MADRID.tz);
    expect(nov.dayLengthDeltaMin).toBeLessThan(0);
  });

  it("golden hour brackets sunrise and sunset", () => {
    const st = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 5, 21), MADRID.tz);
    expect(st.goldenMorningEnd).toBeGreaterThan(st.sunrise!);
    expect(st.goldenEveningStart).toBeLessThan(st.sunset!);
    expect(st.goldenEveningStart).toBeGreaterThan(st.solarNoon);
  });

  it("solar noon sits between sunrise and sunset", () => {
    const st = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 8, 15), MADRID.tz);
    expect(st.solarNoon).toBeGreaterThan(st.sunrise!);
    expect(st.solarNoon).toBeLessThan(st.sunset!);
  });
});
