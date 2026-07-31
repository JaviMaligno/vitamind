import { describe, expect, it } from "vitest";
import { sunForecastFull, type WeatherFetcher } from "../mcp-tools";
import type { WeatherHour } from "../types";

/**
 * The forecast tool exists because the weather changes the answer. Its first
 * version derived the window from the clear-sky curve and only used the forecast
 * for the headline UV number, so a day under 74% cloud reported the same window
 * and the same minutes as a clear one. Nothing caught it, because nothing
 * asserted that two different skies give two different answers.
 */

const MADRID = { lat: 40.42, lon: -3.7, timezone: "Europe/Madrid" } as const;

/** Hourly UV shaped like a day, scaled by how much sun gets through. */
function dayOfHours(date: string, peak: number, cloud: number): WeatherHour[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const arc = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12));
    return { time: `${date}T${String(hour).padStart(2, "0")}:00`, uvIndex: Math.round(peak * arc * 10) / 10, cloudCover: cloud };
  });
}

const fetcherFor = (days: WeatherHour[][]): WeatherFetcher => async () => days.flat();

describe("sunForecastFull", () => {
  it("gives a cloudy day a different answer from a clear one", () => {
    // The whole point of the tool.
    return sunForecastFull(MADRID, fetcherFor([
      dayOfHours("2026-08-01", 8, 5),
      dayOfHours("2026-08-02", 2, 85),
    ])).then(({ text }) => {
      const [clear, cloudy] = text.days!;
      expect(clear.synthesisPossible).toBe(true);
      expect(cloudy.synthesisPossible).toBe(false);
      expect(clear.window).not.toEqual(cloudy.window);
    });
  });

  it("needs more minutes on the weaker day", async () => {
    const { text } = await sunForecastFull(MADRID, fetcherFor([
      dayOfHours("2026-08-01", 9, 0),
      dayOfHours("2026-08-02", 4, 50),
    ]));
    const [strong, weak] = text.days!;
    expect(weak.minutesNeededAtBestHour!).toBeGreaterThan(strong.minutesNeededAtBestHour!);
  });

  it("picks the day with the strongest sun, not the first usable one", async () => {
    const { text } = await sunForecastFull(MADRID, fetcherFor([
      dayOfHours("2026-08-01", 4, 40),
      dayOfHours("2026-08-02", 9, 5),
      dayOfHours("2026-08-03", 5, 30),
    ]));
    expect(text.bestDay).toBe("2026-08-02");
  });

  it("reports no best day when nothing clears the threshold", async () => {
    const { text } = await sunForecastFull(MADRID, fetcherFor([
      dayOfHours("2026-12-01", 1.2, 80),
      dayOfHours("2026-12-02", 0.9, 90),
    ]));
    expect(text.bestDay).toBeNull();
    expect(text.daysWithSun).toBe(0);
    expect(text.days!.every((d) => d.window === null)).toBe(true);
  });

  it("bounds the window by the hours that actually clear the threshold", async () => {
    const { text } = await sunForecastFull(MADRID, fetcherFor([dayOfHours("2026-08-01", 8, 5)]));
    const [d] = text.days!;
    // The synthetic arc peaks at noon and falls away; the window must sit inside
    // daylight rather than spanning the calendar day.
    expect(Number(d.window!.start.slice(0, 2))).toBeGreaterThan(6);
    expect(Number(d.window!.end.slice(0, 2))).toBeLessThan(19);
  });

  it("says so when the provider does not answer, instead of inventing a week", async () => {
    const { text, chart } = await sunForecastFull(MADRID, async () => null);
    expect(text.error).toBe("forecast_unavailable");
    expect(chart).toBeNull();
  });

  it("honours the requested number of days, within bounds", async () => {
    const week = Array.from({ length: 7 }, (_, i) => dayOfHours(`2026-08-0${i + 1}`, 7, 10));
    expect((await sunForecastFull({ ...MADRID, days: 3 }, fetcherFor(week))).text.daysAhead).toBe(3);
    // Out-of-range asks are clamped rather than refused.
    expect((await sunForecastFull({ ...MADRID, days: 99 }, fetcherFor(week))).text.daysAhead).toBe(7);
  });

  it("carries the profile through to the minutes", async () => {
    const week = [dayOfHours("2026-08-01", 7, 10)];
    const fair = await sunForecastFull({ ...MADRID, skinType: 1 }, fetcherFor(week));
    const dark = await sunForecastFull({ ...MADRID, skinType: 6 }, fetcherFor(week));
    expect(dark.text.days![0].minutesNeededAtBestHour!)
      .toBeGreaterThan(fair.text.days![0].minutesNeededAtBestHour!);
  });
});
