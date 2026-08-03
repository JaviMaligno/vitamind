import { describe, expect, it } from "vitest";
import { datesToFill, shouldRewriteToday } from "../useHistory";
import type { DayRecord } from "@/lib/types";

const record = (date: string, cityId: string): DayRecord => ({
  date, cityId, peakUVI: 6, windowStart: 11, windowEnd: 17,
  minutesNeeded: 10, sufficient: true, userOverride: null,
});

/**
 * Backfill used to ask "which days have no record *for this city*", so switching
 * the picker to another city made the whole week look missing and rewrote it
 * with that city. Checking Valencia once from London relabelled the week as
 * Valencia — which is where the six wrong days in the MCP history came from.
 *
 * A day that already has a record is a day already answered, whatever place it
 * names.
 */
describe("datesToFill", () => {
  const week = ["2026-07-13", "2026-07-14", "2026-07-15"].map((d) => record(d, "gps:51.56,-0.10"));
  const NOW = new Date("2026-07-16T10:00:00Z");

  it("leaves days alone that already have a record from somewhere else", () => {
    expect(datesToFill("2026-07-13", "2026-07-15", week, NOW)).toEqual([]);
  });

  it("still fills the days that have nothing at all", () => {
    expect(datesToFill("2026-07-13", "2026-07-16", week, NOW)).toEqual(["2026-07-16"]);
  });

  it("never fills the future", () => {
    expect(datesToFill("2026-07-16", "2026-07-20", week, NOW)).toEqual(["2026-07-16"]);
  });

  it("fills an empty history end to end", () => {
    expect(datesToFill("2026-07-14", "2026-07-16", [], NOW))
      .toEqual(["2026-07-14", "2026-07-15", "2026-07-16"]);
  });
});

/**
 * Today is not settled the way yesterday is.
 *
 * Removing the by-city backfill stopped the past being rewritten every time
 * someone looked at a map — but it also froze today's row at whatever place was
 * selected when it was first written. A real profile ended up with the device
 * reporting London and today's row saying Valencia, permanently.
 *
 * So today follows the device, and only the device: a city picked in the search
 * box is a lookup, not a move.
 */
describe("shouldRewriteToday", () => {
  const row = (cityId: string): DayRecord => record("2026-08-03", cityId);

  it("rewrites when the device reports somewhere else", () => {
    expect(shouldRewriteToday(row("builtin:valencia"), "gps:51.58,-0.09")).toBe(true);
    expect(shouldRewriteToday(row("gps:37.53,-5.08"), "nominatim:51.5877:-0.0975")).toBe(true);
  });

  it("leaves it alone when the device agrees", () => {
    expect(shouldRewriteToday(row("gps:51.58,-0.09"), "gps:51.58,-0.09")).toBe(false);
  });

  it("ignores a city picked in the search box", () => {
    // The bug this whole thread came from: looking up Valencia is not moving to
    // Valencia, and must never touch a stored day.
    expect(shouldRewriteToday(row("gps:51.58,-0.09"), "builtin:valencia")).toBe(false);
    expect(shouldRewriteToday(row("builtin:madrid"), "builtin:valencia")).toBe(false);
  });

  it("writes the row when there is none yet, whatever the source", () => {
    expect(shouldRewriteToday(undefined, "builtin:valencia")).toBe(true);
    expect(shouldRewriteToday(undefined, "gps:51.58,-0.09")).toBe(true);
  });
});
