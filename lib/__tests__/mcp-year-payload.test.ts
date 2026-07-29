import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";

import { vitaminDYearTool, vitaminDYearFull } from "../mcp-tools";
import { cityYearProfile } from "../city-content";

/**
 * The acceptance invariant of the MCP App slice: adding a chart channel to
 * `get_vitamin_d_year` must leave the TEXT an MCP client receives byte-for-byte
 * unchanged. A client with no UI support must not be able to tell the widget
 * exists.
 *
 * The fixture below was captured from the implementation as it stood BEFORE the
 * chart channel was introduced, with `JSON.stringify(value, null, 2)` — the exact
 * serialisation `json()` in lib/mcp-server.ts applies. Comparing the whole string
 * (not a deep-equal on objects) is deliberate: key ORDER is part of the payload,
 * and a deep-equal would sail straight past a reordering.
 *
 * If this test fails, the tool's text output changed. That is the thing this
 * branch promised not to do — regenerate the fixture only with a decision behind
 * it, never to make the suite green.
 */

// London: a mid-latitude city with a real off-season, so the fixture exercises
// every branch — partial months, an exact span, months with no synthesis at all.
const LONDON = { lat: 51.51, lon: -0.13, timezone: "Europe/London" } as const;

const FIXTURE = join(__dirname, "fixtures", "vitamin-d-year-london.json");

const serialize = (value: unknown) => JSON.stringify(value, null, 2);

/**
 * Line endings are the one difference that is NOT the payload: git rewrites the
 * fixture to CRLF on a Windows checkout, while `JSON.stringify` always emits LF.
 * Without this the test fails on Windows and passes in CI for a reason that has
 * nothing to do with the tool. Everything else — key order, spacing, rounding —
 * still has to match exactly.
 */
const normalizeEol = (value: string) => value.replaceAll("\r\n", "\n");

describe("get_vitamin_d_year text payload (frozen)", () => {
  it("serialises to exactly the bytes captured before the widget existed", () => {
    const expected = normalizeEol(readFileSync(FIXTURE, "utf8"));
    expect(serialize(vitaminDYearTool(LONDON))).toBe(expected);
  });

  it("keeps the top-level keys and their order", () => {
    // Spelled out rather than derived, so a rename or a reorder is a visible diff
    // in this file and not just a silently regenerated fixture.
    expect(Object.keys(vitaminDYearTool(LONDON))).toEqual([
      "timesIn",
      "profile",
      "allYear",
      "neverPossible",
      "monthsWithSun",
      "solidMonths",
      "exactViableSpan",
      "summary",
      "byMonth",
      "note",
    ]);
  });

  it("keeps the nested key order too", () => {
    const r = vitaminDYearTool(LONDON);
    expect(Object.keys(r.profile)).toEqual(["skinType", "exposedSkinFraction", "age", "targetIU"]);
    expect(Object.keys(r.exactViableSpan!)).toEqual(["firstDay", "lastDay", "format"]);
    expect(Object.keys(r.summary)).toEqual([
      "viableDaysPerYear",
      "seasonLengthDays",
      "bestMonth",
      "minutesAtBestMonth",
    ]);
    expect(Object.keys(r.byMonth[0])).toEqual([
      "month",
      "synthesisPossible",
      "viableDays",
      "partialMonth",
      "window",
      "minutesNeededAtBestHour",
    ]);
  });

  it("never leaks the 365-day array into the text the model reads", () => {
    // The whole point of the `_meta` channel: `json()` stringifies this object in
    // full, so a `hoursByDay` here would land in the model's context.
    const text = serialize(vitaminDYearTool(LONDON));
    expect(text).not.toContain("hoursByDay");
    expect(text.length).toBeLessThan(6000);
  });
});

describe("vitaminDYearFull", () => {
  it("returns the same text object the tool has always returned", () => {
    expect(serialize(vitaminDYearFull(LONDON).text)).toBe(serialize(vitaminDYearTool(LONDON)));
  });

  it("exposes 365 finite hour readings alongside it", () => {
    const { hoursByDay } = vitaminDYearFull(LONDON);
    expect(hoursByDay).toHaveLength(365);
    expect(hoursByDay.every((h) => typeof h === "number" && Number.isFinite(h))).toBe(true);
    expect(hoursByDay.some((h) => h > 0)).toBe(true);
  });

  it("hands out the very numbers cityYearProfile computes, unrounded", () => {
    const { hoursByDay } = vitaminDYearFull(LONDON);
    expect(hoursByDay).toEqual(cityYearProfile(LONDON.lat, LONDON.lon, 0).hoursByDay);
  });

  it("passes the caller's elevation through to the profile", () => {
    // Elevation shifts the synthesis threshold, so a different elevation must
    // produce a different strip — proof the chart data is not a stale constant.
    const sea = vitaminDYearFull({ ...LONDON, elevationM: 0 }).hoursByDay;
    const high = vitaminDYearFull({ ...LONDON, elevationM: 2000 }).hoursByDay;
    expect(high).not.toEqual(sea);
    expect(high).toEqual(cityYearProfile(LONDON.lat, LONDON.lon, 2000).hoursByDay);
  });
});

describe("cost of the chart channel", () => {
  it("computes the year profile exactly once per call", async () => {
    // cityYearProfile is 365 solar evaluations — the most expensive thing in the
    // tool set. Sourcing hoursByDay by calling it a second time would silently
    // double the cost of the tool, which no assertion on the output would catch.
    vi.resetModules();
    const spy = vi.fn(cityYearProfile);
    vi.doMock("../city-content", async () => ({
      ...(await vi.importActual<typeof import("../city-content")>("../city-content")),
      cityYearProfile: spy,
    }));

    const { vitaminDYearFull: fresh } = await import("../mcp-tools");
    fresh(LONDON);
    expect(spy).toHaveBeenCalledTimes(1);

    vi.doUnmock("../city-content");
    vi.resetModules();
  });
});
