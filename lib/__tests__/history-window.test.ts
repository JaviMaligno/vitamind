import { describe, expect, it, vi } from "vitest";
import { buildHistoryWindow, parseGpsCityId } from "../history-window";
import type { DayRecord, WeatherHour } from "../types";

/**
 * The history stored derivations as if they were facts. A day logged in July
 * reported 53 minutes because that was the profile then; the same day with the
 * profile now is 9. And days nobody logged had nothing at all, though the sun
 * that day is perfectly knowable.
 *
 * So: store what cannot be reconstructed (did you go out, where were you),
 * derive the rest.
 */

const LONDON = { lat: 51.56, lon: -0.1, timezone: "Europe/London" };
const VALENCIA = { lat: 39.47, lon: -0.38, timezone: "Europe/Madrid" };

const CITIES: Record<string, typeof LONDON> = {
  "gps:51.56,-0.10": LONDON,
  "builtin:valencia": VALENCIA,
};
const resolveCity = (id: string) => CITIES[id] ?? parseGpsCityId(id);

const PROFILE = { skinType: 3 as const, area: 0.25, targetIU: 1000, age: null };

/** A record as the app writes it, derived fields included and deliberately stale. */
const record = (date: string, cityId: string, over: Partial<DayRecord> = {}): DayRecord => ({
  date, cityId, peakUVI: 5.7, windowStart: 11, windowEnd: 17,
  minutesNeeded: 53, sufficient: true, userOverride: null, ...over,
});

/** Hourly UV shaped like a day, scaled by how much sun gets through. */
const dayHours = (date: string, peak: number, cloud = 10): WeatherHour[] =>
  Array.from({ length: 24 }, (_, hour) => ({
    time: `${date}T${String(hour).padStart(2, "0")}:00`,
    uvIndex: Math.max(0, Math.round(peak * Math.sin((Math.PI * (hour - 6)) / 12) * 10) / 10),
    cloudCover: cloud,
  }));

const fetcherFor = (peak: number, cloud = 10) =>
  vi.fn(async (_lat: number, _lon: number, from: string, to: string) => {
    const out: WeatherHour[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
      out.push(...dayHours(new Date(t).toISOString().slice(0, 10), peak, cloud));
    }
    return out;
  });

const build = (over: Partial<Parameters<typeof buildHistoryWindow>[0]> = {}) =>
  buildHistoryWindow({
    from: "2026-07-20", to: "2026-07-27",
    records: [record("2026-07-20", "gps:51.56,-0.10"), record("2026-07-27", "gps:51.56,-0.10", { userOverride: true })],
    profile: PROFILE, resolveCity, fetchRange: fetcherFor(6), ...over,
  });

describe("buildHistoryWindow", () => {
  it("returns one day per date, with no gaps", async () => {
    const days = await build();
    expect(days).toHaveLength(8);
    expect(days[0].date).toBe("2026-07-20");
    expect(days[7].date).toBe("2026-07-27");
  });

  it("inherits the location from the last known day, and says it did", async () => {
    const days = await build();
    const gap = days.find((d) => d.date === "2026-07-23")!;
    expect(gap.cityId).toBe("gps:51.56,-0.10");
    expect(gap.locationAssumed).toBe(true);
    // A day that has its own record is not an assumption.
    expect(days[0].locationAssumed).toBe(false);
  });

  it("falls forward when the gap comes before any record", async () => {
    const days = await buildHistoryWindow({
      from: "2026-07-18", to: "2026-07-20",
      records: [record("2026-07-20", "builtin:valencia")],
      profile: PROFILE, resolveCity, fetchRange: fetcherFor(7),
    });
    expect(days[0].cityId).toBe("builtin:valencia");
    expect(days[0].locationAssumed).toBe(true);
  });

  it("leaves a day without a window when no location is knowable at all", async () => {
    const days = await buildHistoryWindow({
      from: "2026-07-20", to: "2026-07-21", records: [],
      profile: PROFILE, resolveCity, fetchRange: fetcherFor(7),
    });
    expect(days.every((d) => d.cityId === null && d.windowStart === null)).toBe(true);
    expect(days.every((d) => d.sufficient === false)).toBe(true);
  });

  it("recomputes the minutes with the current profile, ignoring what was stored", async () => {
    // The stored record says 53 minutes; the profile in play says otherwise.
    const days = await build();
    const logged = days.find((d) => d.date === "2026-07-27")!;
    expect(logged.minutesNeeded).not.toBe(53);
    expect(logged.minutesNeeded).toBeLessThan(30);
  });

  it("moves with the profile, which is the whole point", async () => {
    const fair = await build({ profile: { ...PROFILE, skinType: 1 } });
    const dark = await build({ profile: { ...PROFILE, skinType: 6 } });
    const at = (days: Awaited<ReturnType<typeof build>>) =>
      days.find((d) => d.date === "2026-07-23")!.minutesNeeded!;
    expect(at(dark)).toBeGreaterThan(at(fair));
  });

  it("takes the answer only from the record, never from the weather", async () => {
    const days = await build();
    expect(days.find((d) => d.date === "2026-07-27")!.wentOutside).toBe(true);
    // Every other day had sun and no answer. Sun is not an answer.
    expect(days.filter((d) => d.date !== "2026-07-27").every((d) => d.wentOutside === null)).toBe(true);
  });

  it("asks the provider once per location, not once per day", async () => {
    const fetchRange = fetcherFor(6);
    await buildHistoryWindow({
      from: "2026-07-20", to: "2026-07-27",
      records: [record("2026-07-20", "builtin:valencia"), record("2026-07-24", "gps:51.56,-0.10")],
      profile: PROFILE, resolveCity, fetchRange,
    });
    // Two locations across eight days: two calls, not eight.
    expect(fetchRange).toHaveBeenCalledTimes(2);
  });

  it("carries the real cloud cover into the verdict", async () => {
    // 23 July in London was 96% cloud and UV 3.8, measured. A clear-sky answer
    // for the same day says 8 minutes, which is the lie this replaces.
    const clear = await build({ fetchRange: fetcherFor(7, 5) });
    const hazy = await build({ fetchRange: fetcherFor(4, 70) });
    const at = (days: Awaited<ReturnType<typeof build>>) => days.find((d) => d.date === "2026-07-23")!;
    expect(at(clear).sufficient).toBe(true);
    expect(at(hazy).peakUVI!).toBeLessThan(at(clear).peakUVI!);
    expect(at(hazy).minutesNeeded!).toBeGreaterThan(at(clear).minutesNeeded!);
    expect(at(clear).uvSource).toBe("observed");
  });

  it("gives a day too dim to be worth anything no window at all", async () => {
    // Not a shorter window — none. Below the synthesis threshold there is
    // nothing to go outside for, and the calendar should not pretend otherwise.
    const days = await build({ fetchRange: fetcherFor(2, 96) });
    const day = days.find((d) => d.date === "2026-07-23")!;
    expect(day.sufficient).toBe(false);
    expect(day.windowStart).toBeNull();
    expect(day.minutesNeeded).toBeNull();
    // The location is still known, and still reported.
    expect(day.cityId).toBe("gps:51.56,-0.10");
  });

  it("says so when it fell back to the clear-sky model", async () => {
    // The provider is allowed to fail; inventing a number silently is not.
    const days = await build({ fetchRange: async () => null });
    expect(days.every((d) => d.uvSource === "clear-sky")).toBe(true);
    // And it still answers, rather than emptying the calendar.
    expect(days.find((d) => d.date === "2026-07-23")!.minutesNeeded).toBeGreaterThan(0);
  });

  it("handles a single-day window", async () => {
    const days = await buildHistoryWindow({
      from: "2026-07-23", to: "2026-07-23",
      records: [record("2026-07-23", "gps:51.56,-0.10")],
      profile: PROFILE, resolveCity, fetchRange: fetcherFor(6),
    });
    expect(days).toHaveLength(1);
  });
});

describe("parseGpsCityId", () => {
  it("reads the id the app writes when it uses the device location", () => {
    // Every real record in production has this shape; cityRef only knew the
    // builtin and custom forms, so those days resolved to nothing.
    expect(parseGpsCityId("gps:51.5644,-0.1069")).toMatchObject({ lat: 51.5644, lon: -0.1069 });
  });

  it("ignores anything that is not one", () => {
    expect(parseGpsCityId("builtin:madrid")).toBeNull();
    expect(parseGpsCityId("gps:over-there")).toBeNull();
    expect(parseGpsCityId("gps:91,0")).toBeNull();
  });
});
