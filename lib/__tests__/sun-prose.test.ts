import { describe, it, expect } from "vitest";
import { sunProse } from "@/lib/sun-prose";
import { BUILTIN_CITIES } from "@/lib/cities";
import { dailySunTimes, getSunTimes } from "@/lib/sun-times";
import { getCurve, doyFromMonthDay, dateFromDoy } from "@/lib/solar";
import { computeExposureFromCurve } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

const city = (slug: string) => {
  const c = BUILTIN_CITIES.find((x) => x.id === `builtin:${slug}`);
  if (!c) throw new Error(`fixture city missing: ${slug}`);
  return c;
};

describe("sunProse regimes", () => {
  it("reports a synthesis window for Madrid in August", () => {
    const p = sunProse(city("madrid"), 7);
    expect(p.regime).toBe("synthesis");
    expect(p.vitD).not.toBeNull();
    expect(p.vitD!.windowStart).toBeLessThan(p.vitD!.windowEnd);
    expect(p.vitD!.minutesNeeded).toBeGreaterThan(0);
  });

  it("reports no synthesis for Madrid in December", () => {
    // Webb, Kline & Holick (1988): mid-latitude winter has no vitamin D window.
    expect(sunProse(city("madrid"), 11).regime).toBe("none");
    expect(sunProse(city("madrid"), 11).vitD).toBeNull();
  });

  it("reports polar day for Tromso in June", () => {
    // Tromso is 69.65°N, inside the Arctic Circle: all 30 June days are polar
    // day, and `dailySunTimes` gives them null sunrise/sunset (no sentinel).
    const p = sunProse(city("tromso"), 5);
    expect(p.regime).toBe("polar");
    expect(p.firstSunrise).toBeNull();
    expect(p.lastSunset).toBeNull();
  });

  it("reports polar night for Tromso in December", () => {
    // The same branch has to catch the other polar case: a sun that never rises.
    const p = sunProse(city("tromso"), 11);
    expect(p.regime).toBe("polar");
    expect(p.firstSunrise).toBeNull();
  });

  it("does NOT report polar for Reykjavik in June, which is south of the Arctic Circle", () => {
    // 64.15°N: the June sun dips below the horizon every night, so this is an
    // ordinary — very long — month, and saying otherwise would be a false claim
    // on a page whose whole point is stating true ones.
    const p = sunProse(city("reikiavik"), 5);
    expect(p.regime).not.toBe("polar");
    expect(p.firstSunrise).not.toBeNull();
    expect(p.lastSunset).not.toBeNull();
  });
});

describe("sunProse figures agree with the page's own sources", () => {
  it("first and last day match dailySunTimes for that month", () => {
    const c = city("madrid");
    const days = dailySunTimes(c.lat, c.lon, 7, c.timezone, c.tz);
    const p = sunProse(c, 7);
    expect(p.firstSunrise).toBeCloseTo(days[0].sunrise!, 5);
    expect(p.firstSunset).toBeCloseTo(days[0].sunset!, 5);
    expect(p.lastSunrise).toBeCloseTo(days[days.length - 1].sunrise!, 5);
    expect(p.lastSunset).toBeCloseTo(days[days.length - 1].sunset!, 5);
    expect(p.days).toBe(days.length);
  });

  it("states the latitude it was given, not a rounded constant", () => {
    expect(sunProse(city("madrid"), 7).lat).toBeCloseTo(city("madrid").lat, 4);
  });

  it("day-length change is last minus first, signed", () => {
    const p = sunProse(city("madrid"), 7);
    expect(p.dayLengthDeltaMin).toBeLessThan(0); // August shortens in the north
  });

  it("mid-month day length is the same figure the page's snapshot card shows", () => {
    const c = city("madrid");
    const mid = getSunTimes(c.lat, c.lon, dateFromDoy(doyFromMonthDay(7, 15)), c.timezone, c.tz);
    expect(sunProse(c, 7).midDayLengthMin).toBeCloseTo((mid.sunset! - mid.sunrise!) * 60, 6);
  });

  it("peak elevation and the vitamin D figures come from the model, not a constant", () => {
    const c = city("madrid");
    const doy15 = doyFromMonthDay(7, 15);
    const curve = getCurve(c.lat, c.lon, doy15, c.tz, c.timezone);
    const exposure = computeExposureFromCurve(curve, 3, 0.25, 1000, null, {
      ozoneDu: ozoneDU(c.lat, c.lon, doy15),
      elevationM: c.elevation ?? 0,
    });
    const p = sunProse(c, 7);
    expect(p.peakElevationDeg).toBeCloseTo(Math.max(...curve.map((x) => x.elevation)), 6);
    expect(p.vitD!.windowStart).toBe(exposure!.windowStart);
    expect(p.vitD!.windowEnd).toBe(exposure!.windowEnd);
    expect(p.vitD!.minutesNeeded).toBe(Math.round(exposure!.minutesNeeded));
    expect(p.vitD!.bestUVI).toBeCloseTo(exposure!.bestUVI, 1);
  });

  it("never reports a negative day length when sunset falls after local midnight", () => {
    // Sub-arctic summer: the sun sets after 00:00 local, so the sunrise/sunset
    // hours the model returns are wrapped into 0–24 and the raw subtraction
    // `sunset - sunrise` goes negative. Reykjavik already renders that on 13 of
    // its 30 June rows. A paragraph claiming a day lasts "-2 h 58 min" is worse
    // than no paragraph, so the module reports the real length.
    const wrapping = {
      ...city("reikiavik"),
      id: "builtin:wrapping-fixture",
      timezone: undefined, // force the numeric fallback offset below
      tz: 1,               // one hour east of Reykjavik's real zone
    };
    const mid = getSunTimes(wrapping.lat, wrapping.lon, dateFromDoy(doyFromMonthDay(5, 15)), undefined, 1);
    expect(mid.sunset!).toBeLessThan(mid.sunrise!); // the wrap really happens

    const p = sunProse(wrapping, 5);
    expect(p.midDayLengthMin).toBeGreaterThan(1200);
    expect(p.midDayLengthMin).toBeLessThan(1440);
    expect(p.midDayLengthMin).toBeCloseTo(mid.dayLengthMin, 6);
  });
});
