import { describe, it, expect, afterAll } from "vitest";
import { cityYearProfile } from "../city-content";
import {
  vitaminDYearTool,
  vitaminDWindowTool,
  sunTimesTool,
  estimateSunSessionTool,
} from "../mcp-tools";
import { dateFromDoy, dayOfYear } from "../solar";

/**
 * Solar geometry does not know what timezone the server is in. Neither should
 * the answers: the same coordinates, the same date and the same explicit
 * `timezone` argument must produce identical output whether the process runs on
 * Vercel (UTC), on a laptop in Madrid, or on a machine in Tokyo.
 *
 * This is issue #25. The leak was the day-of-year calendar: dates built with
 * the local-time constructor and read back with local getters drift by a day
 * whenever the offset differs between January and the date in question — which
 * is every DST zone, half the year.
 */

const ZONES = ["UTC", "Europe/Madrid", "America/New_York", "Asia/Tokyo", "Pacific/Kiritimati"];

const originalTz = process.env.TZ;
afterAll(() => { process.env.TZ = originalTz; });

/** Runs `compute` once per timezone and returns [zone, JSON] pairs. */
function acrossZones<T>(compute: () => T): Array<[string, string]> {
  return ZONES.map((zone) => {
    process.env.TZ = zone;
    return [zone, JSON.stringify(compute())] as [string, string];
  });
}

function expectIdentical(results: Array<[string, string]>) {
  const [referenceZone, reference] = results[0];
  for (const [zone, value] of results.slice(1)) {
    // Named zones in the message so a failure says WHERE it diverged.
    expect(value, `${zone} differs from ${referenceZone}`).toBe(reference);
  }
}

const LONDON = { lat: 51.51, lon: -0.13, timezone: "Europe/London" } as const;

describe("the day-of-year calendar", () => {
  it("maps a day to the same calendar date in every zone", () => {
    expectIdentical(acrossZones(() => dateFromDoy(182).toISOString()));
  });

  it("round-trips a day number through a date", () => {
    expectIdentical(acrossZones(() => [1, 60, 182, 300, 365].map((doy) => dayOfYear(dateFromDoy(doy)))));
  });

  it("numbers the first of each month identically", () => {
    // The regression that started this: byMonth's start day came from
    // `dayOfYear(new Date(2026, m, 1))`, which is a day short in any zone whose
    // offset changes between January and that month.
    expectIdentical(acrossZones(() =>
      Array.from({ length: 12 }, (_, m) => dayOfYear(dateFromDoy(1 + m * 30)))));
  });
});

describe("tool output is independent of the server's timezone", () => {
  it("cityYearProfile", () => {
    expectIdentical(acrossZones(() => cityYearProfile(LONDON.lat, LONDON.lon, 0)));
  });

  it("get_vitamin_d_year", () => {
    expectIdentical(acrossZones(() => vitaminDYearTool(LONDON)));
  });

  it("get_vitamin_d_window", () => {
    expectIdentical(acrossZones(() => vitaminDWindowTool({ ...LONDON, date: "2026-07-15" })));
  });

  it("get_sun_times", () => {
    expectIdentical(acrossZones(() => sunTimesTool({ ...LONDON, date: "2026-07-15" })));
  });

  it("estimate_sun_session", () => {
    expectIdentical(acrossZones(() =>
      estimateSunSessionTool({ ...LONDON, date: "2026-07-15", minutes: 20 })));
  });

  it("holds on a southern-hemisphere city too", () => {
    // Sydney's DST runs opposite to the northern zones, so a bug that cancels
    // out in London can still show up here.
    expectIdentical(acrossZones(() =>
      vitaminDYearTool({ lat: -33.87, lon: 151.21, timezone: "Australia/Sydney" })));
  });
});
