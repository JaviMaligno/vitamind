import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
afterAll(() => {
  // Assigning `undefined` to an env var stores the STRING "undefined", which
  // resolves to Etc/Unknown, and vitest reuses a worker across files. CI leaves
  // TZ unset, so this is the normal path rather than the edge case.
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

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

/**
 * A source guard, and the only kind available for this one.
 *
 * The reference-year date is where the host zone gets in: `new Date(2026, 5, 15)`
 * is 15 June 00:00 in whatever zone the builder happens to be in, which is a
 * different INSTANT on every machine, and both a solar table and a zone-offset
 * probe read that instant. The offenders it was written for were
 * `getSunTimes(..., new Date(2026, 5, 15), ...)` on the city page — three
 * different digests of the 73 cities' golden-hour figures across UTC, Canary,
 * Madrid and Honolulu — and `tzOffsetForDate(zone, new Date(YEAR, m, d))` in
 * lib/schema.ts, which made a Honolulu build publish 12 Events a UTC build
 * drops.
 *
 * Neither is reachable through an export: one lives inside an async server
 * component, the other inside a module-private helper whose effect is visible
 * only as an absence. So the test reads the source. It is narrow on purpose —
 * these two files, and the multi-argument `Date` constructor with a year first,
 * which in them is always a mistake. Elsewhere it is not: a host-local
 * constructor read back by a host-local getter cancels, which is why
 * `lib/city-copy.ts` may format a month name that way.
 */
describe("build-time modules never place a reference-year date in the host's zone", () => {
  // `process.cwd()` rather than `import.meta.url`: the jsdom environment gives
  // the module a http: URL, which `fileURLToPath` refuses. Vitest runs from the
  // project root, and the read below fails loudly if that ever stops being true.
  const REPO = process.cwd();
  const FILES = [
    join("app", "[locale]", "[cityPrefix]", "[city]", "page.tsx"),
    join("lib", "schema.ts"),
    join("lib", "solar.ts"),
    join("lib", "sun-times.ts"),
  ];

  /** Source with comment lines dropped: those name the old forms on purpose. */
  const codeLines = (file: string) =>
    readFileSync(join(REPO, file), "utf8")
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));

  it.each(FILES)("%s", (file) => {
    // `new Date(2026, …` or `new Date(DOY_REFERENCE_YEAR, …` — the host-local
    // constructor. `new Date(Date.UTC(…))` does not match, which is the point.
    const offenders = codeLines(file)
      .filter(({ line }) => /new Date\(\s*(\d{4}|DOY_REFERENCE_YEAR|REF_YEAR)\s*,/.test(line))
      .map(({ line, n }) => `${file}:${n}: ${line.trim()}`);
    expect(offenders).toEqual([]);
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
