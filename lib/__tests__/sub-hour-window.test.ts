import { describe, it, expect } from "vitest";
import { BUILTIN_CITIES } from "@/lib/cities";
import { getCurve, doyFromMonthDay } from "@/lib/solar";
import { computeExposureFromCurve, estimateUVFromElevation, minutesForVitD, MIN_UVI } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * `getCurve` returns a point every five minutes. `computeExposureFromCurve` used
 * to keep one point in twelve — the one at `h:00` — and answer from those 24
 * samples. So a window that happened to contain no clock hour was reported as no
 * window at all, and every window it did report had both edges dragged to the
 * next clock hour.
 *
 * Whether a city kept its window near the season edge therefore depended on its
 * longitude inside its timezone, which is not a fact about its sun. And the dose
 * is ~19 minutes at UVI 3 for the page's default reader, so the windows being
 * discarded were usable ones.
 */

const DEFAULT = { skin: 3 as const, area: 0.25, iu: 1000 };

/** The window the curve actually contains, scanned point by point. */
function truth(lat: number, lon: number, tz: number, timezone: string | undefined, elevationM: number, doy: number) {
  const ctx = { ozoneDu: ozoneDU(lat, lon, doy), elevationM };
  const curve = getCurve(lat, lon, doy, tz, timezone);
  const above = curve.filter((p) => estimateUVFromElevation(p.elevation, ctx) >= MIN_UVI);
  return above.length ? { start: above[0].localHours, end: above[above.length - 1].localHours } : null;
}

function exposureFor(c: (typeof BUILTIN_CITIES)[number], doy: number) {
  const elevationM = c.elevation ?? 0;
  return computeExposureFromCurve(
    getCurve(c.lat, c.lon, doy, c.tz, c.timezone),
    DEFAULT.skin, DEFAULT.area, DEFAULT.iu, null,
    { ozoneDu: ozoneDU(c.lat, c.lon, doy), elevationM },
  );
}

describe("the clear-sky window is read at the curve's resolution", () => {
  it("never reports 'no window' on a day the curve has one — all 73 cities, all 365 days", () => {
    const lost: string[] = [];
    for (const c of BUILTIN_CITIES) {
      for (let doy = 1; doy <= 365; doy++) {
        const t = truth(c.lat, c.lon, c.tz, c.timezone, c.elevation ?? 0, doy);
        if (t && !exposureFor(c, doy)) lost.push(`${c.name} doy ${doy}`);
      }
    }
    // Hourly sampling lost 80 city-days across 36 cities — Casablanca 19,
    // Phoenix 18 — because their solar noon sits far from a clock hour.
    expect(lost).toEqual([]);
  });

  it("reports the window's real edges, not the clock hours around them", () => {
    for (const c of BUILTIN_CITIES) {
      for (const doy of [15, 105, 196, 288, 350]) {
        const t = truth(c.lat, c.lon, c.tz, c.timezone, c.elevation ?? 0, doy);
        const e = exposureFor(c, doy);
        if (!t || !e) continue;
        expect(e.windowStart, `${c.name} doy ${doy} start`).toBeCloseTo(t.start, 10);
        expect(e.windowEnd, `${c.name} doy ${doy} end`).toBeCloseTo(t.end, 10);
      }
    }
  });

  it("keeps the sub-hour windows at the end of a season", () => {
    // London, 27 September: the last day of its synthesis season, a 35-minute
    // window from 12:35 to 13:10 BST. The dose is ~19 min, so this is a usable
    // day, and the old sampler kept it only by the accident of 13:00 landing
    // inside it. Casablanca is the case where that accident does not happen.
    const london = BUILTIN_CITIES.find((c) => c.id === "builtin:londres")!;
    const e = exposureFor(london, doyFromMonthDay(8, 27))!;
    expect(e).not.toBeNull();
    const span = (e.windowEnd - e.windowStart) * 60;
    expect(span).toBeGreaterThan(30);
    expect(span).toBeLessThan(60);
    expect(minutesForVitD(e.bestUVI, DEFAULT.skin, DEFAULT.area, DEFAULT.iu, null)!).toBeLessThan(span);
  });

  it("centres every window on the day's peak, which hourly sampling did not", () => {
    // A clear-sky window is symmetric about solar noon by construction. This is
    // the invariant that makes the recorded figures checkable without a second
    // implementation of the model — and the one the old sampler violated by up
    // to half an hour while every test still passed.
    for (const c of BUILTIN_CITIES) {
      for (const doy of [80, 172, 264, 355]) {
        const e = exposureFor(c, doy);
        if (!e) continue;
        const midpoint = (e.windowStart + e.windowEnd) / 2;
        // Half the 5-minute step, plus float noise.
        expect(Math.abs(midpoint - e.bestHour) * 60, `${c.name} doy ${doy}`).toBeLessThanOrEqual(2.5 + 1e-9);
      }
    }
  });

  it("still reports one chart row per clock hour", () => {
    // `hourlyMinutes` feeds the day-curve chart; a chart of hours wants hours.
    const madrid = BUILTIN_CITIES.find((c) => c.id === "builtin:madrid")!;
    const e = exposureFor(madrid, 196)!;
    expect(e.hourlyMinutes.map((r) => r.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });
});
