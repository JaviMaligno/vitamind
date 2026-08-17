import { describe, it, expect, afterAll } from "vitest";
import { getSunTimes, dailySunTimes, monthlySunTimes, type SunTimes } from "../sun-times";
import { fmtTime, dayOfYear, doyFromMonthDay, getCurve, solarElev, DOY_REFERENCE_YEAR } from "../solar";
import { tzOffsetForDate } from "../timezone";
import { sunTodayData } from "../sun-today";
import { BUILTIN_CITIES } from "../cities";
import { SUNRISE_CITIES } from "../sun-routes";
import { baseSlug } from "../city-routes";

/**
 * A sunrise happens at an INSTANT. The instant is astronomy and knows nothing
 * about timezones; the clock time we print is only that instant presented in
 * the city's zone. So there is an identity this module must satisfy, and it
 * needs no ephemeris copied from a website to check:
 *
 *   printed local time == Intl.DateTimeFormat(zone).format(the event's instant)
 *
 * Both bugs this file exists for violate it. The offset used to be read at the
 * *start* of the day, so on a DST transition day every printed time carried the
 * pre-transition offset; and the dates were built with the host-local `Date`
 * constructor, so the same page rendered differently on a laptop and on Vercel.
 */

const originalTz = process.env.TZ;
afterAll(() => {
  // Assigning `undefined` to an env var stores the STRING "undefined", which
  // resolves to Etc/Unknown — and vitest reuses a worker across files, so that
  // would leak a bogus host zone into whatever runs next. CI leaves TZ unset,
  // so this is the normal path, not the edge case.
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

type EventKey = "sunrise" | "sunset" | "solarNoon" | "civilDawn" | "civilDusk";
const EVENTS: EventKey[] = ["sunrise", "sunset", "solarNoon", "civilDawn", "civilDusk"];

const HH_MM = new Map<string, Intl.DateTimeFormat>();
function zoneFormat(zone: string) {
  let f = HH_MM.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    HH_MM.set(zone, f);
  }
  return f;
}

/** `{ date: "YYYY-MM-DD", time: "HH:MM" }` for an instant, read in `zone`. */
function readInZone(at: Date, zone: string) {
  const p = Object.fromEntries(zoneFormat(zone).formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * The event's instant, obtained WITHOUT any timezone machinery: asked with no
 * zone and a zero fallback, `getSunTimes` returns hours from UTC midnight of
 * the day, straight out of the solar model.
 *
 * `wrap24` folds that into 0-24, losing whether the raw value was negative (an
 * Australian sunrise is the previous UTC day) or past 24. The candidate whose
 * calendar date IN THE ZONE is the requested one is the event we asked about,
 * and there can be only one — the candidates are 24 h apart.
 */
function instantOf(
  lat: number, lon: number, y: number, m: number, d: number, zone: string, key: EventKey,
): Date | null {
  const utcH = getSunTimes(lat, lon, new Date(Date.UTC(y, m, d)), undefined, 0)[key];
  if (utcH === null) return null;
  const midnight = Date.UTC(y, m, d);
  const wanted = iso(y, m, d);
  const hits = [-1, 0, 1]
    .map((k) => midnight + (utcH + k * 24) * 3_600_000)
    .filter((ms) => readInZone(new Date(ms), zone).date === wanted);
  expect(hits, `no instant of ${key} lands on ${wanted} in ${zone}`).toHaveLength(1);
  // `fmtTime` rounds to the nearest minute and `Intl` truncates, so an instant
  // at 18:49:35 would "disagree" with itself. Rounding here compares the two on
  // the same terms; every real UTC offset is a whole number of minutes, so this
  // cannot hide an offset error.
  return new Date(Math.round(hits[0] / 60_000) * 60_000);
}

/** Every event of one city-day, checked against the identity. Returns failures. */
function identityMismatches(
  city: { lat: number; lon: number; timezone?: string; tz: number; name: string },
  y: number, m: number, d: number,
): string[] {
  const zone = city.timezone!;
  const st: SunTimes = getSunTimes(city.lat, city.lon, new Date(Date.UTC(y, m, d)), zone, city.tz);
  const out: string[] = [];
  for (const key of EVENTS) {
    const hours = st[key];
    if (hours === null) continue;
    const at = instantOf(city.lat, city.lon, y, m, d, zone, key);
    if (at === null) continue;
    const expected = readInZone(at, zone).time;
    if (fmtTime(hours) !== expected) {
      out.push(`${city.name} ${iso(y, m, d)} ${key}: printed ${fmtTime(hours)}, zone says ${expected}`);
    }
  }
  return out;
}

const CITIES = BUILTIN_CITIES.filter((c) => SUNRISE_CITIES.includes(baseSlug(c.id)) && c.timezone);

/** Fixed control days: five spread through every month, 60 in the year. */
const CONTROL_DAYS = [1, 8, 15, 22, 28];

/**
 * The days of the reference year worth checking in a zone: the fixed controls,
 * plus every UTC day across which the zone's offset changes and the day before
 * it, so the local transition day is in the set wherever it falls relative to
 * UTC midnight. 60 to 64 days per city, against 365.
 *
 * WHY NOT ALL 365. The sweep ran every city on every day: 14 600 city-days,
 * seconds of real work under a 60 s timeout, on a machine with a history of
 * dying under load. What the other 300 days per city buy is ordinary days, and
 * an offset bug cannot hide on one: away from a transition the zone holds a
 * single offset all day, so the days of a month behave alike and the fifth
 * ordinary day tells you nothing the first did not. The whole file's tests now
 * run in under ten seconds (7.5 s and 8.7 s on two runs of this machine), with
 * the timeouts halved to 30 s.
 *
 * The transition days themselves are still DISCOVERED, not listed: which days
 * they are is a fact about the tzdata the runtime ships (in this Node's copy
 * America/Vancouver has a March 2026 transition and no November one), so
 * hardcoding them would be the same mistake in a different place.
 *
 * Traded away: a bug that fires on exactly one ordinary day of some month —
 * which would have to come from the solar model rather than the zone handling,
 * and `lib/__tests__/sun-times.test.ts` covers that model against fixed values.
 */
function daysWorthChecking(zone: string): Array<{ m: number; d: number }> {
  const out = new Map<string, { m: number; d: number }>();
  const add = (ms: number) => {
    const at = new Date(ms);
    if (at.getUTCFullYear() !== DOY_REFERENCE_YEAR) return;
    const [m, d] = [at.getUTCMonth(), at.getUTCDate()];
    out.set(`${m}-${d}`, { m, d });
  };
  for (let m = 0; m < 12; m++) for (const d of CONTROL_DAYS) add(Date.UTC(DOY_REFERENCE_YEAR, m, d));
  const start = Date.UTC(DOY_REFERENCE_YEAR, 0, 1);
  let previous = tzOffsetForDate(zone, new Date(start));
  for (let day = 1; day < 365; day++) {
    const at = start + day * 86_400_000;
    const offset = tzOffsetForDate(zone, new Date(at));
    if (offset !== previous) {
      add(at - 86_400_000);
      add(at);
      previous = offset;
    }
  }
  return [...out.values()];
}

describe("the printed time is the event's instant, read in the city's zone", () => {
  it("holds for every shipped city on every transition day and the controls", { timeout: 30_000 }, () => {
    process.env.TZ = "UTC";
    const failures: string[] = [];
    let checked = 0;
    for (const city of CITIES) {
      for (const { m, d } of daysWorthChecking(city.timezone!)) {
        checked++;
        failures.push(...identityMismatches(city, DOY_REFERENCE_YEAR, m, d));
      }
    }
    // A sanity floor on the sample itself: a `daysWorthChecking` that silently
    // returned nothing would make this test pass by checking nothing.
    expect(checked).toBeGreaterThan(CITIES.length * 60);
    // Sliced: an unfixed regression would list hundreds and the diff would be
    // unreadable. The count goes in the message so nothing is hidden.
    expect(failures.slice(0, 12), `${failures.length} mismatches`).toEqual([]);
  });

  it("Chicago on 1 November 2026 prints the offset in force at sunrise, not at midnight", () => {
    process.env.TZ = "UTC";
    // The clocks go back at 02:00 local that morning — 07:00 UTC, 5 h 26 min
    // before the sun rises. The old probe read the zone at 00:00 UTC — 19:00 the
    // previous evening in Chicago, still -05:00 — and the page shipped 07:26.
    // The sun rises at 12:26 UTC, which is 06:26 in a zone at -06:00.
    const chicago = CITIES.find((c) => c.timezone === "America/Chicago")!;
    const st = getSunTimes(chicago.lat, chicago.lon, new Date(Date.UTC(2026, 10, 1)), chicago.timezone, chicago.tz);
    expect(fmtTime(st.sunrise!)).toBe("06:26");
    expect(fmtTime(st.sunset!)).toBe("16:42");
  });
});

/**
 * The instant the city's clock reads `hour:00` on that date, or null when that
 * wall clock is not a single instant: a spring-forward day has no 02:00 and an
 * autumn day has two 01:00s.
 *
 * The candidate offsets are every offset the zone uses anywhere near the day,
 * probed hourly — brute force on purpose, so this helper shares no reasoning
 * with the code it checks.
 */
function offsetsAround(zone: string, utcMidnight: number): number[] {
  const offsets = new Set<number>();
  for (let h = -14; h <= 38; h++) offsets.add(tzOffsetForDate(zone, new Date(utcMidnight + h * 3_600_000)));
  return [...offsets];
}

function instantOfLocalHour(
  zone: string, utcMidnight: number, offsets: number[], wantedDate: string, hour: number,
): Date | null {
  const wantedTime = `${String(hour).padStart(2, "0")}:00`;
  const hits = new Set(
    offsets
      .map((o) => utcMidnight + (hour - o) * 3_600_000)
      .filter((ms) => {
        const read = readInZone(new Date(ms), zone);
        return read.date === wantedDate && read.time === wantedTime;
      }),
  );
  return hits.size === 1 ? new Date([...hits][0]) : null;
}

/**
 * The other half of the same identity, for the day curve.
 *
 * `getCurve` is indexed by WALL CLOCK — its consumers ask "what is the sun
 * doing at 13:00 here" — so it performs the inverse conversion to `getSunTimes`:
 * clock time to instant, rather than instant to clock time. It carried the same
 * bug in the same shape, reading one offset for the whole day at UTC midnight,
 * and it drives the vitamin D window, which is what the city hub is ABOUT. With
 * `getSunTimes` fixed and this not, a hub page printed a sunrise placed by the
 * offset in force at sunrise beside a window placed by the offset in force the
 * previous evening — 35 city-days a year where the page contradicted itself.
 */
describe("the day curve is sampled at the instants the city's clock names", () => {
  it("every unambiguous hour of every transition day and control day", { timeout: 30_000 }, () => {
    process.env.TZ = "UTC";
    const failures: string[] = [];
    for (const city of CITIES) {
      for (const { m, d } of daysWorthChecking(city.timezone!)) {
        const utcMidnight = Date.UTC(DOY_REFERENCE_YEAR, m, d);
        const doy = dayOfYear(new Date(utcMidnight));
        const curve = getCurve(city.lat, city.lon, doy, city.tz, city.timezone);
        const offsets = offsetsAround(city.timezone!, utcMidnight);
        for (let hour = 0; hour < 24; hour++) {
          const at = instantOfLocalHour(city.timezone!, utcMidnight, offsets, iso(DOY_REFERENCE_YEAR, m, d), hour);
          if (at === null) continue;
          const expected = solarElev(city.lat, city.lon, doy, (at.getTime() - utcMidnight) / 3_600_000);
          const sample = curve.find((p) => Math.abs(p.localHours - hour) < 1e-9)!;
          if (Math.abs(sample.elevation - expected) > 1e-9) {
            failures.push(
              `${city.name} ${iso(DOY_REFERENCE_YEAR, m, d)} ${hour}:00 — curve ${sample.elevation.toFixed(3)}°, ` +
              `zone's own instant ${at.toISOString()} gives ${expected.toFixed(3)}°`,
            );
          }
        }
      }
    }
    expect(failures.slice(0, 12), `${failures.length} mismatches`).toEqual([]);
  });

  /**
   * The three city-days the review named, as the page renders them.
   *
   * These are wall-clock facts about the zone, not preferences: Madrid is at
   * +01:00 from 03:00 local on 25 October, Chicago at -05:00 from 03:00 local on
   * 8 March, Los Angeles at -08:00 from 01:00 local on 1 November — so on all
   * three the whole daylight span sits on one side of the transition and every
   * printed figure of the day belongs to that offset. Before the curve was
   * fixed the sunrise below was already right and the window was an hour out in
   * the direction of the pre-transition offset (13:00–16:00, 11:00–14:00,
   * 11:00–15:00 respectively).
   */
  it("the hub prints a window and a sunrise placed by the same offset", () => {
    process.env.TZ = "UTC";
    const cases = [
      { id: "builtin:madrid", monthIndex: 9, day: 25, sunrise: "07:40", window: ["12:00", "15:00"] },
      { id: "builtin:chicago", monthIndex: 2, day: 8, sunrise: "07:18", window: ["12:00", "15:00"] },
      { id: "builtin:los-angeles", monthIndex: 10, day: 1, sunrise: "06:15", window: ["10:00", "14:00"] },
    ];
    const got = cases.map(({ id, monthIndex, day }) => {
      const city = BUILTIN_CITIES.find((c) => c.id === id)!;
      const data = sunTodayData(city, { year: DOY_REFERENCE_YEAR, monthIndex, day, doy: doyFromMonthDay(monthIndex, day) });
      return {
        id, monthIndex, day,
        sunrise: fmtTime(data.sun.sunrise!),
        window: [fmtTime(data.exposure!.windowStart), fmtTime(data.exposure!.windowEnd)],
      };
    });
    expect(got).toEqual(cases);
  });
});

/**
 * Where two serialisations first diverge, as a short excerpt — the payloads are
 * whole years of tables and a raw diff of them tells a reader nothing.
 */
function firstDifference(a: string, b: string): string | null {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 70);
  return `at ${i}: …${a.slice(from, i + 20)} vs …${b.slice(from, i + 20)}`;
}

/** The same computation under three host zones; every string must match. */
function acrossHostZones(compute: () => unknown): void {
  const zones = ["UTC", "Atlantic/Canary", "Pacific/Honolulu"];
  const results = zones.map((z) => {
    process.env.TZ = z;
    return [z, JSON.stringify(compute())] as const;
  });
  for (const [zone, value] of results.slice(1)) {
    expect(firstDifference(results[0][1], value), `${zone} differs from ${results[0][0]}`).toBeNull();
  }
}

describe("the tables do not depend on the timezone of the machine that builds them", () => {
  const madrid = BUILTIN_CITIES.find((c) => c.id === "builtin:madrid")!;

  it("dailySunTimes: Madrid in August is the same table in every host zone", { timeout: 30_000 }, () => {
    // Measured before the fix: the local build emitted 07:11/21:31 where Vercel
    // (UTC) emitted 07:12/21:30. Production was correct only by the accident of
    // Vercel building in UTC — an undeclared dependency, not a property.
    acrossHostZones(() => dailySunTimes(madrid.lat, madrid.lon, 7, madrid.timezone, madrid.tz));
  });

  // Explicit timeouts on the sweeps: they are seconds of real work, and the
  // 5 s default turns a loaded machine into a red test that says nothing about
  // the code.
  it("dailySunTimes: every month of every shipped city", { timeout: 60_000 }, () => {
    acrossHostZones(() =>
      CITIES.map((c) => Array.from({ length: 12 }, (_, m) =>
        dailySunTimes(c.lat, c.lon, m, c.timezone, c.tz))));
  });

  it("monthlySunTimes: the twelve summary rows too", { timeout: 30_000 }, () => {
    acrossHostZones(() => CITIES.map((c) => monthlySunTimes(c.lat, c.lon, c.timezone, c.tz)));
  });

  it("dailySunTimes returns the right number of rows whatever the host zone", { timeout: 30_000 }, () => {
    // A guard, not a regression test. The old row count came from
    // `new Date(2026, m + 1, 0).getDate()`, which is host-INdependent: the
    // host-local constructor and the host-local getter cancel, and it returns
    // the same twelve counts in every zone tried. This pins the property the
    // replacement must keep, and would have passed before the fix too.
    acrossHostZones(() =>
      Array.from({ length: 12 }, (_, m) => dailySunTimes(40.4, -3.7, m, "Europe/Madrid", 1).length));
  });
});
