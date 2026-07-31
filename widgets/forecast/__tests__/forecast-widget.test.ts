import { describe, expect, it } from "vitest";
import { readForecastMeta, skyIcon, weekdayIndex, dayOfMonth, FORECAST_META_KEY, type ForecastMeta } from "../data";
import { renderForecast, headline, dayLabel } from "../render";
import { forecastStrings, WIDGET_LOCALES } from "../i18n";

const day = (date: string, over: Record<string, unknown> = {}) => ({
  date, peakUVIndex: 6.2, avgCloudPercent: 20,
  window: { start: "11:00", end: "17:00" }, minutesNeededAtBestHour: 14,
  synthesisPossible: true, ...over,
});

const wrap = (payload: unknown) => ({ content: [], _meta: { [FORECAST_META_KEY]: payload } });

const meta = (over: Partial<ForecastMeta> = {}): ForecastMeta => ({
  days: [
    { date: "2026-07-31", peakUVIndex: 4.1, avgCloudPercent: 70, windowStart: "12:00", windowEnd: "16:00", minutesNeeded: 22, synthesisPossible: true },
    { date: "2026-08-01", peakUVIndex: 7.8, avgCloudPercent: 10, windowStart: "11:00", windowEnd: "17:00", minutesNeeded: 12, synthesisPossible: true },
    { date: "2026-08-02", peakUVIndex: 0.6, avgCloudPercent: 95, windowStart: null, windowEnd: null, minutesNeeded: null, synthesisPossible: false },
  ],
  bestDay: "2026-08-01",
  ...over,
});

describe("readForecastMeta", () => {
  it("reads a well-formed forecast", () => {
    const m = readForecastMeta(wrap({ days: [day("2026-07-31"), day("2026-08-01")], bestDay: "2026-08-01" }));
    expect(m?.days).toHaveLength(2);
    expect(m?.bestDay).toBe("2026-08-01");
    expect(m?.days[0].windowStart).toBe("11:00");
  });

  it("drops entries with no usable date instead of rendering blanks", () => {
    const m = readForecastMeta(wrap({ days: [day("2026-07-31"), { date: "soon" }, {}], bestDay: null }));
    expect(m?.days).toHaveLength(1);
  });

  it("refuses a forecast with no days at all", () => {
    expect(readForecastMeta(wrap({ days: [], bestDay: null }))).toBeNull();
    expect(readForecastMeta(wrap({}))).toBeNull();
    expect(readForecastMeta(null)).toBeNull();
  });

  it("ignores a bestDay that is not a date", () => {
    expect(readForecastMeta(wrap({ days: [day("2026-07-31")], bestDay: "tuesday" }))?.bestDay).toBeNull();
  });

  it("caps at a week — the tool offers at most seven days", () => {
    const days = Array.from({ length: 12 }, (_, i) => day(`2026-08-${String(i + 1).padStart(2, "0")}`));
    expect(readForecastMeta(wrap({ days, bestDay: null }))?.days).toHaveLength(7);
  });
});

describe("skyIcon", () => {
  it("uses the same thresholds as the app's forecast row", () => {
    expect(skyIcon(10, 6)).toBe("☀️");
    expect(skyIcon(50, 6)).toBe("⛅");
    expect(skyIcon(85, 6)).toBe("🌥️");
    // Below UV 1 the cloud cover is beside the point: there is no sun to shade.
    expect(skyIcon(0, 0.5)).toBe("☁️");
  });
});

describe("dates", () => {
  it("reads weekday and day-of-month without a local Date", () => {
    expect(weekdayIndex("2026-07-27")).toBe(0); // Monday
    expect(dayOfMonth("2026-08-01")).toBe(1);
  });
});

describe("dayLabel", () => {
  it("names the first two days by relation, the rest by weekday", () => {
    expect(dayLabel("2026-07-31", 0, "es")).toBe("hoy");
    expect(dayLabel("2026-08-01", 1, "es")).toBe("mañana");
    // 2026-08-02 is a Sunday.
    expect(dayLabel("2026-08-02", 2, "es")).toBe("dom");
  });
});

describe("headline — the decision, before the rows", () => {
  it("names the day worth picking", () => {
    expect(headline(meta(), "es")).toBe("Mejor día: mañana");
  });

  it("says so when today already is the best day", () => {
    expect(headline(meta({ bestDay: "2026-07-31" }), "es")).toBe(forecastStrings("es").bestIsToday);
  });

  it("admits when no day works", () => {
    expect(headline(meta({ bestDay: null }), "es")).toBe(forecastStrings("es").noSun);
  });

  it("stops naming a winner when every day wins", () => {
    // "Best day: Friday" on a week where today already works reads as a reason
    // to wait, which is the opposite of the advice.
    const allGood: ForecastMeta = {
      bestDay: "2026-08-02",
      days: [
        { date: "2026-07-31", peakUVIndex: 9.1, avgCloudPercent: 5, windowStart: "10:00", windowEnd: "18:00", minutesNeeded: 9, synthesisPossible: true },
        { date: "2026-08-01", peakUVIndex: 9.3, avgCloudPercent: 8, windowStart: "10:00", windowEnd: "18:00", minutesNeeded: 9, synthesisPossible: true },
        { date: "2026-08-02", peakUVIndex: 9.6, avgCloudPercent: 3, windowStart: "10:00", windowEnd: "18:00", minutesNeeded: 8, synthesisPossible: true },
      ],
    };
    expect(headline(allGood, "es")).toBe(forecastStrings("es").anyDay);
  });

  it("still names the day when one is missing from the run", () => {
    // One unusable day is enough to make the choice meaningful again.
    expect(headline(meta(), "es")).toBe("Mejor día: mañana");
  });

  it("leaves no unfilled placeholders", () => {
    expect(headline(meta(), "de")).not.toContain("{");
  });
});

describe("renderForecast", () => {
  it("draws a row per day and no chart", () => {
    // The question is "which day", and the answer is a name — not a shape to
    // compare bar heights against. See docs/widget-design.md.
    const html = renderForecast({ meta: meta(), locale: "es" });
    expect(html).not.toContain("<svg");
    expect((html.match(/UV /g) ?? [])).toHaveLength(3);
  });

  it("marks the best day so it is found without reading", () => {
    const html = renderForecast({ meta: meta(), locale: "es" });
    expect(html).toContain("#ffb020");
    expect((html.match(/box-shadow:inset 0 0 0 1px #ffb020/g) ?? [])).toHaveLength(1);
  });

  it("says 'no window' rather than leaving a day blank", () => {
    expect(renderForecast({ meta: meta(), locale: "es" })).toContain(forecastStrings("es").noWindow);
  });

  it("shows the empty state when nothing arrived", () => {
    expect(renderForecast({ meta: null, locale: "es" })).toContain(forecastStrings("es").empty);
  });

  it("puts the headline before the first row", () => {
    const html = renderForecast({ meta: meta(), locale: "es" });
    expect(html.indexOf("Mejor día")).toBeLessThan(html.indexOf("UV "));
  });
});

describe("copy", () => {
  it("covers every language, including seven weekday names", () => {
    for (const locale of WIDGET_LOCALES) {
      const copy = forecastStrings(locale);
      expect(copy.weekdays, locale).toHaveLength(7);
      expect(copy.weekdays.every((d) => d.length > 0), locale).toBe(true);
      expect(copy.bestIs, locale).toContain("{day}");
      expect(copy.anyDay.length, locale).toBeGreaterThan(0);
      expect(copy.noSun.length, locale).toBeGreaterThan(0);
    }
  });
});
