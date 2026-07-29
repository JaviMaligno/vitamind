import { describe, it, expect } from "vitest";
import {
  HEAT_MAX_HOURS,
  HEAT_LOW,
  HEAT_HIGH,
  HEAT_LEGEND_GRADIENT,
  heatT,
  heatColor,
  yearStripColumns,
  yearStripViewBox,
} from "@/lib/year-strip";

describe("heat ramp", () => {
  it("pins the two ends of the ramp to the published constants", () => {
    // These two strings are the contract: the city pages ship them in static
    // HTML and the MCP widget must draw the identical ramp.
    expect(heatColor(0)).toBe(HEAT_LOW);
    expect(heatColor(HEAT_MAX_HOURS)).toBe(HEAT_HIGH);
    expect(HEAT_LOW).toBe("hsl(45, 80%, 15%)");
    expect(HEAT_HIGH).toBe("hsl(20, 100%, 65%)");
  });

  it("keeps the exact string format the server-rendered markup already emits", () => {
    // Byte-identical to `hsl(${45 - t * 25}, ${80 + t * 20}%, ${15 + t * 50}%)`
    // as it was inlined in CityYearStrip: spaces after the commas, same order
    // of operations (no float drift), no rounding.
    expect(heatColor(5)).toBe("hsl(32.5, 90%, 40%)");
    expect(heatColor(2)).toBe("hsl(40, 84%, 25%)");
  });

  it("clamps above the ramp maximum instead of overflowing the hue", () => {
    expect(heatT(0)).toBe(0);
    expect(heatT(HEAT_MAX_HOURS)).toBe(1);
    expect(heatT(24)).toBe(1);
    expect(heatColor(24)).toBe(HEAT_HIGH);
  });

  it("clamps below zero too — a negative hour count must not invert the ramp", () => {
    expect(heatT(-3)).toBe(0);
    expect(heatColor(-3)).toBe(HEAT_LOW);
  });

  it("exposes a legend gradient built from the same two ends", () => {
    expect(HEAT_LEGEND_GRADIENT).toContain("hsl(45,80%,15%)");
    expect(HEAT_LEGEND_GRADIENT).toContain("hsl(20,100%,65%)");
  });
});

describe("yearStripColumns", () => {
  it("emits one unit-wide column per day, indexed by day", () => {
    const hours = [0, 5, HEAT_MAX_HOURS];
    const cols = yearStripColumns(hours);
    expect(cols).toHaveLength(3);
    expect(cols.map((c) => c.x)).toEqual([0, 1, 2]);
    expect(cols.every((c) => c.width === 1)).toBe(true);
    expect(cols[0].fill).toBe(HEAT_LOW);
    expect(cols[2].fill).toBe(HEAT_HIGH);
  });

  it("handles a full year without dropping or padding days", () => {
    expect(yearStripColumns(new Array(365).fill(0))).toHaveLength(365);
  });
});

describe("yearStripViewBox", () => {
  it("derives the width from the day count instead of hardcoding 365", () => {
    // The old component hardcoded width=365; a 366-long array then drew off the
    // canvas silently. The viewBox now follows the data.
    expect(yearStripViewBox(365, 48)).toBe("0 0 365 48");
    expect(yearStripViewBox(366, 110)).toBe("0 0 366 110");
  });
});
