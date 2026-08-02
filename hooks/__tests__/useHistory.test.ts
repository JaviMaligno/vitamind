import { describe, expect, it } from "vitest";
import { datesToFill } from "../useHistory";
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
