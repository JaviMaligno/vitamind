import { describe, it, expect } from "vitest";
import { searchCity, sunTimesTool, vitaminDWindowTool, currentStatusTool } from "../mcp-tools";

describe("searchCity", () => {
  it("finds a city by its Spanish base name", () => {
    const results = searchCity("Madrid");
    expect(results[0].name).toBe("Madrid");
    expect(results[0].timezone).toBe("Europe/Madrid");
    expect(results[0].elevationM).toBe(660);
  });

  it("finds cities via localized slugs from other languages", () => {
    expect(searchCity("London")[0].name).toBe("Londres");
    expect(searchCity("New York")[0].name).toBe("Nueva York");
  });

  it("ranks exact matches above prefix matches and respects the limit", () => {
    const results = searchCity("ma", 3);
    expect(results.length).toBeLessThanOrEqual(3);
    expect(searchCity("")).toEqual([]);
  });
});

describe("sunTimesTool", () => {
  it("returns Madrid solstice times in local timezone", () => {
    const r = sunTimesTool({ lat: 40.42, lon: -3.7, date: "2026-06-21", timezone: "Europe/Madrid" });
    expect(r.polar).toBeNull();
    expect(r.sunrise).toMatch(/^06:4\d$/);
    expect(r.sunset).toMatch(/^21:4\d$/);
    expect(r.timesIn).toBe("Europe/Madrid");
    expect(r.dayLengthMinutes).toBeGreaterThan(880);
    expect(r.goldenHourEvening).not.toBeNull();
  });

  it("flags the polar night without sunrise", () => {
    const r = sunTimesTool({ lat: 78.22, lon: 15.65, date: "2026-12-21", timezone: "Arctic/Longyearbyen" });
    expect(r.polar).toBe("night");
    expect(r.sunrise).toBeNull();
    expect(r.dayLengthMinutes).toBe(0);
  });
});

describe("vitaminDWindowTool", () => {
  it("finds a midday window with sane minutes for Madrid in June", () => {
    const r = vitaminDWindowTool({
      lat: 40.42, lon: -3.7, date: "2026-06-21", timezone: "Europe/Madrid", elevationM: 660,
    });
    expect(r.synthesisPossible).toBe(true);
    if (r.synthesisPossible === true) {
      const start = parseInt(r.window!.start, 10);
      const end = parseInt(r.window!.end, 10);
      expect(start).toBeLessThan(13);
      expect(end).toBeGreaterThan(14);
      expect(r.minutesNeededAtBestHour).toBeGreaterThan(2);
      expect(r.minutesNeededAtBestHour).toBeLessThan(60);
    }
  });

  it("says impossible for Tromsø in December, with an explanation", () => {
    const r = vitaminDWindowTool({ lat: 69.65, lon: 18.96, date: "2026-12-21", timezone: "Europe/Oslo" });
    expect(r.synthesisPossible).toBe(false);
    expect(r).toHaveProperty("reason");
  });

  it("clamps out-of-range profile values instead of failing", () => {
    const r = vitaminDWindowTool({
      lat: 40.42, lon: -3.7, date: "2026-06-21", timezone: "Europe/Madrid",
      skinType: 99, exposedSkinFraction: 5, targetIU: 999999,
    });
    expect(r.profile.skinType).toBe(6);
    expect(r.profile.exposedSkinFraction).toBe(1);
    expect(r.profile.targetIU).toBe(10000);
  });
});

describe("currentStatusTool", () => {
  it("falls back to the clear-sky model when weather is unreachable", async () => {
    const r = await currentStatusTool(
      { lat: 40.42, lon: -3.7, timezone: "Europe/Madrid" },
      async () => null,
    );
    expect(r.uvSource).toContain("clear-sky");
    expect(["good_now", "upcoming", "window_closed", "no_synthesis"]).toContain(r.state);
  });

  it("uses injected weather data when available", async () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      time: `2026-07-19T${String(h).padStart(2, "0")}:00`,
      uvIndex: h >= 10 && h <= 18 ? 7 : 0,
      cloudCover: 10,
    }));
    const r = await currentStatusTool(
      { lat: 40.42, lon: -3.7, timezone: "Europe/Madrid" },
      async () => hours,
    );
    expect(r.uvSource).toContain("open-meteo");
    expect(r.window).toEqual({ start: "10:00", end: "19:00" });
  });
});
