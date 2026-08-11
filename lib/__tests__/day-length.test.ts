import { describe, it, expect } from "vitest";
import { dayLengthMinutes } from "@/lib/solar";
import { BUILTIN_CITIES } from "@/lib/cities";
import { dailySunTimes } from "@/lib/sun-times";

/**
 * Local sunrise/sunset come back wrapped into 0–24, so above roughly 63° in
 * midsummer a sunset after local midnight reads as a smaller number than the
 * sunrise. Subtracting naively then yields a negative day length — which
 * `/amanecer/reikiavik/junio` rendered on 13 of its 30 table rows, in
 * production.
 */
describe("dayLengthMinutes", () => {
  it("handles an ordinary day", () => {
    expect(dayLengthMinutes(7, 21)).toBe(14 * 60);
  });

  it("handles a sunset after local midnight", () => {
    // Reykjavik, 17 June: rises 02:56, sets 00:00 the next day.
    expect(dayLengthMinutes(2.94, 0)).toBeCloseTo(21.06 * 60, 0);
  });

  it("never returns a negative duration", () => {
    for (let rise = 0; rise < 24; rise += 0.5) {
      for (let set = 0; set < 24; set += 0.5) {
        expect(dayLengthMinutes(rise, set), `${rise}->${set}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("returns null when either end is missing, as on a polar day", () => {
    expect(dayLengthMinutes(null, 12)).toBeNull();
    expect(dayLengthMinutes(6, null)).toBeNull();
    expect(dayLengthMinutes(null, null)).toBeNull();
  });
});

describe("the Reykjavik June regression", () => {
  const city = BUILTIN_CITIES.find((c) => c.id === "builtin:reikiavik")!;

  it("gives every June day a positive length", () => {
    const days = dailySunTimes(city.lat, city.lon, 5, city.timezone, city.tz);
    const negative = days
      .map((d) => ({ day: d.day, len: dayLengthMinutes(d.sunrise, d.sunset) }))
      .filter((x) => x.len !== null && x.len < 0);
    expect(negative).toEqual([]);
  });

  it("gives midsummer days close to 21 hours, not a few minutes", () => {
    const days = dailySunTimes(city.lat, city.lon, 5, city.timezone, city.tz);
    const mid = dayLengthMinutes(days[14].sunrise, days[14].sunset);
    expect(mid).not.toBeNull();
    expect(mid!).toBeGreaterThan(19 * 60);
  });
});
