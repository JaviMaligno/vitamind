import { describe, it, expect } from "vitest";
import { getSunTimes, monthlySunTimes, dailySunTimes } from "../sun-times";

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

describe("monthlySunTimes", () => {
  it("Madrid: 12 ordered entries, June days longer than December, no polar months", () => {
    const months = monthlySunTimes(MADRID.lat, MADRID.lon, MADRID.tz);
    expect(months).toHaveLength(12);
    expect(months.map((m) => m.monthIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const june = months[5];
    const december = months[11];
    expect(june.sunrise).toBeLessThan(december.sunrise!);
    expect(june.sunset).toBeGreaterThan(december.sunset!);
    expect(june.dayLengthMin).toBeGreaterThan(december.dayLengthMin);
    for (const m of months) expect(m.polar).toBeNull();
  });

  it("Madrid entries reflect DST: June sunset after 21:00 local, December before 19:00", () => {
    const months = monthlySunTimes(MADRID.lat, MADRID.lon, MADRID.tz);
    expect(months[5].sunset).toBeGreaterThan(21);
    expect(months[11].sunset).toBeLessThan(19);
  });

  it("Svalbard: polar day in June, polar night in December", () => {
    const months = monthlySunTimes(78.22, 15.65, undefined, 1);
    const june = months[5];
    expect(june.polar).toBe("day");
    expect(june.sunrise).toBeNull();
    expect(june.dayLengthMin).toBe(1440);
    const december = months[11];
    expect(december.polar).toBe("night");
    expect(december.dayLengthMin).toBe(0);
  });

  it("southern hemisphere: June days shorter than December days", () => {
    const months = monthlySunTimes(-33.87, 151.21, "Australia/Sydney");
    expect(months[5].dayLengthMin).toBeLessThan(months[11].dayLengthMin);
  });
});

describe("civil twilight and dailySunTimes", () => {
  it("civil dawn precedes sunrise and civil dusk follows sunset by ~30 min in Madrid", () => {
    const st = getSunTimes(MADRID.lat, MADRID.lon, new Date(2026, 5, 21), MADRID.tz);
    expect(st.civilDawn).toBeLessThan(st.sunrise!);
    expect(st.civilDusk).toBeGreaterThan(st.sunset!);
    expect((st.sunrise! - st.civilDawn!) * 60).toBeGreaterThan(20);
    expect((st.sunrise! - st.civilDawn!) * 60).toBeLessThan(45);
  });

  it("dailySunTimes covers every day of the month in order", () => {
    const june = dailySunTimes(MADRID.lat, MADRID.lon, 5, MADRID.tz);
    expect(june).toHaveLength(30);
    expect(june[0].day).toBe(1);
    expect(june[29].day).toBe(30);
    const feb = dailySunTimes(MADRID.lat, MADRID.lon, 1, MADRID.tz);
    expect(feb).toHaveLength(28);
    for (const d of june) {
      expect(d.civilDawn).toBeLessThan(d.sunrise!);
      expect(d.civilDusk).toBeGreaterThan(d.sunset!);
    }
  });

  it("polar night in Svalbard December has no sunrise but keeps polar flag", () => {
    const dec = dailySunTimes(78.22, 15.65, 11, undefined, 1);
    expect(dec[20].polar).toBe("night");
    expect(dec[20].sunrise).toBeNull();
  });
});
