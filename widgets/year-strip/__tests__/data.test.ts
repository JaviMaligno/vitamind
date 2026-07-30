import { describe, it, expect } from "vitest";
import { YEAR_STRIP_META_KEY, readYearStripMeta } from "../data";

const validResult = (hoursByDay: number[]) => ({
  content: [{ type: "text", text: "{}" }],
  _meta: { [YEAR_STRIP_META_KEY]: { hoursByDay } },
});

const year = () => Array.from({ length: 365 }, (_, i) => (i % 11) / 1);

describe("readYearStripMeta", () => {
  it("pulls the chart data out of the tool result's _meta", () => {
    const payload = readYearStripMeta(validResult(year()));
    expect(payload).not.toBeNull();
    // Normalised into a one-element place list: the comparison tool sends
    // several, and both shapes reach the renderer the same way.
    expect(payload!.places).toHaveLength(1);
    expect(payload!.places[0].hoursByDay).toHaveLength(365);
    expect(payload!.places[0].hoursByDay[0]).toBe(0);
  });

  it("returns null when the result carries no _meta at all", () => {
    // The host forwards the whole CallToolResult; a text-only result from an
    // older server version must degrade to the empty state, not throw.
    expect(readYearStripMeta({ content: [{ type: "text", text: "{}" }] })).toBeNull();
    expect(readYearStripMeta({ content: [], _meta: {} })).toBeNull();
  });

  it("returns null for junk instead of trusting the wire", () => {
    expect(readYearStripMeta(null)).toBeNull();
    expect(readYearStripMeta(undefined)).toBeNull();
    expect(readYearStripMeta("nope")).toBeNull();
    expect(readYearStripMeta({ _meta: { [YEAR_STRIP_META_KEY]: {} } })).toBeNull();
    expect(readYearStripMeta({ _meta: { [YEAR_STRIP_META_KEY]: { hoursByDay: "x" } } })).toBeNull();
    expect(readYearStripMeta(validResult([]))).toBeNull();
  });

  it("rejects arrays holding non-finite values", () => {
    expect(readYearStripMeta(validResult([1, Number.NaN, 3]))).toBeNull();
    expect(readYearStripMeta(validResult([1, Infinity]))).toBeNull();
    expect(readYearStripMeta({ _meta: { [YEAR_STRIP_META_KEY]: { hoursByDay: [1, "2", 3] } } })).toBeNull();
  });

  it("rejects absurdly long arrays — a year has 365 columns, not 100k", () => {
    expect(readYearStripMeta(validResult(new Array(4000).fill(1)))).toBeNull();
  });

  it("accepts a leap-length array so the viewBox can follow the data", () => {
    expect(readYearStripMeta(validResult(new Array(366).fill(1)))!.places[0].hoursByDay).toHaveLength(366);
  });
});
