import { describe, it, expect } from "vitest";
import { sunPageGraph } from "../schema";
import { dailySunTimes } from "../sun-times";
import { fmtTime, DOY_REFERENCE_YEAR } from "../solar";
import { tzOffsetForDate } from "../timezone";
import { BUILTIN_CITIES } from "../cities";
import { SUNRISE_CITIES } from "../sun-routes";
import type { City } from "../types";

/**
 * THE TWO DAYS A YEAR A ZONE HAS NO SINGLE OFFSET.
 *
 * A sunrise is an instant. The clock time a page prints and the offset its
 * JSON-LD labels that instant with are two presentations of the SAME instant, so
 * both have to be read at the instant itself. Deriving either from a fixed probe
 * — midnight of that day, whichever offset the day happened to start in — is
 * right on 363 days and an hour out on the other two.
 *
 * `lib/sun-times.ts` was moved onto an event-instant probe already; this file
 * locks that in on the four transition days named below, and adds the half that
 * was deliberately deferred with it: `lib/schema.ts` still probed the day's
 * start, and rather than publish an offset the zone does not hold it dropped the
 * Event outright. Silence is not the fix — the Event is exactly what these pages
 * exist to publish.
 *
 * Madrid and New York transition on DIFFERENT dates (EU: last Sunday of March
 * and October, at 01:00 UTC for the whole union; US: second Sunday of March and
 * first Sunday of November, at 02:00 LOCAL, so 07:00 UTC in New York). A fix
 * that keyed off a date rather than off the zone would pass one pair and fail
 * the other.
 */

const cityNamed = (name: string): City => {
  const city = BUILTIN_CITIES.find((c) => c.name === name);
  if (!city) throw new Error(`no builtin city named ${name}`);
  return city;
};

const MARCH = 2, OCTOBER = 9, NOVEMBER = 10;

interface Transition {
  label: string;
  city: City;
  base: string;
  monthIndex: number;
  day: number;
  /** The offset in hours the zone is in AFTER the transition, for the record. */
  direction: "forward" | "back";
}

const TRANSITIONS: Transition[] = [
  { label: "Madrid, last Sunday of March (+01:00 -> +02:00 at 01:00 UTC)", city: cityNamed("Madrid"), base: "madrid", monthIndex: MARCH, day: 29, direction: "forward" },
  { label: "Madrid, last Sunday of October (+02:00 -> +01:00 at 01:00 UTC)", city: cityNamed("Madrid"), base: "madrid", monthIndex: OCTOBER, day: 25, direction: "back" },
  { label: "Nueva York, second Sunday of March (-05:00 -> -04:00 at 07:00 UTC)", city: cityNamed("Nueva York"), base: "nueva-york", monthIndex: MARCH, day: 8, direction: "forward" },
  { label: "Nueva York, first Sunday of November (-04:00 -> -05:00 at 06:00 UTC)", city: cityNamed("Nueva York"), base: "nueva-york", monthIndex: NOVEMBER, day: 1, direction: "back" },
];

/** Guards the fixture: a date that stopped being a transition proves nothing. */
function transitionsThatDay(zone: string, monthIndex: number, day: number): boolean {
  const start = Date.UTC(DOY_REFERENCE_YEAR, monthIndex, day);
  const offsets = new Set<number>();
  for (let h = 0; h <= 36; h++) offsets.add(tzOffsetForDate(zone, new Date(start + h * 3_600_000)));
  return offsets.size > 1;
}

const zoneClock = new Map<string, Intl.DateTimeFormat>();
/** "HH:MM" for an instant, read in `zone` — the answer the reader's own clock gives. */
function wallClockIn(zone: string, at: Date): string {
  let fmt = zoneClock.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    zoneClock.set(zone, fmt);
  }
  return fmt.format(at);
}

describe.each(TRANSITIONS)("$label", ({ city, base, monthIndex, day }) => {
  const zone = city.timezone!;
  const row = () => dailySunTimes(city.lat, city.lon, monthIndex, zone, city.tz)[day - 1];

  it("is still a transition day in this Node's tzdata", () => {
    // ICU is a platform dependency: Vancouver lost its late-2026 transition on
    // one ICU build already (see the sun-times instant suite). If this fails the
    // fixture is stale, not the code.
    expect(transitionsThatDay(zone, monthIndex, day)).toBe(true);
  });

  it("is a page the site actually ships", () => {
    expect(SUNRISE_CITIES).toContain(base);
  });

  const graph = () =>
    sunPageGraph({
      city, base, cityName: city.name, locale: "es", monthIndex,
      url: `https://getvitamind.app/amanecer/${base}/mes`,
      pageName: `Amanecer y atardecer en ${city.name}`,
      labels: { sunrise: "Amanecer", sunset: "Atardecer", cities: "Ciudades" },
      days: [{ day, sunrise: row().sunrise, sunset: row().sunset }],
      faq: [],
    })["@graph"].filter((n) => n["@type"] === "Event");

  it("publishes both Events instead of going silent", () => {
    // The deferred half of the bug: the day-start probe disagreed with the
    // instant, and `sunEvent` dropped the node rather than label it falsely.
    expect(graph()).toHaveLength(2);
  });

  it.each(["sunrise", "sunset"] as const)("labels the %s with an offset the zone holds at that instant", (kind) => {
    const events = graph();
    const event = events[kind === "sunrise" ? 0 : 1];
    const startDate = event.startDate as string;
    const instant = new Date(startDate);
    expect(Number.isNaN(instant.getTime()), `${startDate} does not parse`).toBe(false);

    // The claim the label makes, checked against the zone itself.
    const declared = startDate.slice(-6);
    const held = tzOffsetForDate(zone, instant);
    const sign = held < 0 ? "-" : "+";
    const abs = Math.abs(held);
    const expected = `${sign}${String(Math.floor(abs)).padStart(2, "0")}:${String(Math.round((abs % 1) * 60)).padStart(2, "0")}`;
    expect(declared, `${startDate} names an offset ${zone} is not in`).toBe(expected);
  });

  it.each(["sunrise", "sunset"] as const)("puts the %s instant on the clock time the page prints", (kind) => {
    // The identity that ties the two surfaces together: whatever instant the
    // JSON-LD designates, a reader in the city reads the page's own figure off
    // their clock at that moment.
    const events = graph();
    const event = events[kind === "sunrise" ? 0 : 1];
    const printed = fmtTime(row()[kind]!);
    expect(wallClockIn(zone, new Date(event.startDate as string))).toBe(printed);
  });
});
