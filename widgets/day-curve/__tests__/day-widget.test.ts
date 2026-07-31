import { describe, expect, it } from "vitest";
import { readDayMeta, statusKey, formatCountdown, fmtMin, DAY_CURVE_META_KEY, type DayMeta } from "../data";
import { renderDay, verdict, stats } from "../render";
import { DAY_COPY } from "../generated-copy";
import { resolveWidgetLocale, emptyText, WIDGET_LOCALES } from "../i18n";
import { getStatusKey, formatCountdown as appCountdown, fmtMin as appFmtMin } from "@/components/dashboard/day-status";

/**
 * This widget answers "should I go outside now?", and #29 established that the
 * answer is a verdict plus a few numbers — the same thing the app's own hero
 * shows — not an elevation curve the reader has to decode first.
 */

const base: DayMeta = {
  state: "good_now", intensity: "optimal", uvIndex: 7.4, minutesNeeded: 12,
  windowStart: 11, windowEnd: 17, minutesUntilWindow: null, windowClosesInMinutes: 95,
  bestHour: 14, bestMinutes: 10, cloudCoverPercent: 15, cloudDegraded: false,
};
const meta = (over: Partial<DayMeta> = {}): DayMeta => ({ ...base, ...over });
const wrap = (payload: unknown) => ({ content: [], _meta: { [DAY_CURVE_META_KEY]: payload } });

describe("agreement with the app", () => {
  it("derives the same verdict key as the dashboard does", () => {
    // Both sides must classify a moment identically, or the chat and the app
    // describe the same instant differently.
    const cases = [
      { state: "good_now", intensity: "optimal" },
      { state: "good_now", intensity: "moderate" },
      { state: "upcoming", intensity: null },
      { state: "window_closed", intensity: null },
      { state: "no_synthesis", intensity: null },
    ] as const;
    for (const c of cases) {
      expect(statusKey(c), JSON.stringify(c))
        .toBe(getStatusKey({ ...c, currentUVI: 0, effectiveUVI: 0, minutesNeeded: null, window: null,
          bestHour: null, bestMinutes: null, minutesUntilWindow: null, windowClosesIn: null,
          cloudCover: null, cloudDegraded: false }));
    }
  });

  it("formats durations exactly as the app does", () => {
    for (const m of [0.4, 1, 45, 59, 60, 61, 125, 600]) {
      expect(formatCountdown(m), `countdown ${m}`).toBe(appCountdown(m));
      expect(fmtMin(m), `fmtMin ${m}`).toBe(appFmtMin(m));
    }
  });

  it("uses the app's own sentences, not new ones", () => {
    // The copy is lifted from messages/*.json at build time; a widget that
    // paraphrased would drift the moment anyone edited the app.
    expect(verdict(meta(), "es").headline).toBe(DAY_COPY.es.nowOptimalTitle);
    expect(verdict(meta({ intensity: "moderate" }), "es").headline).toBe(DAY_COPY.es.nowModerateTitle);
  });
});

describe("verdict", () => {
  it("distinguishes optimal from merely usable", () => {
    const a = verdict(meta({ intensity: "optimal" }), "en").headline;
    const b = verdict(meta({ intensity: "moderate" }), "en").headline;
    expect(a).not.toBe(b);
  });

  it("fills the countdown and hour into the upcoming headline", () => {
    const v = verdict(meta({ state: "upcoming", intensity: null, minutesUntilWindow: 95, windowStart: 11 }), "en");
    expect(v.headline).toContain("1h 35min");
    expect(v.headline).toContain("11:00");
    expect(v.headline).not.toContain("{");
  });

  it("names the hour the window closed", () => {
    const v = verdict(meta({ state: "window_closed", intensity: null, windowEnd: 17 }), "en");
    expect(v.headline).toContain("17:00");
    expect(v.hint).toBe(DAY_COPY.en.nowClosedHint);
  });

  it("blames the clouds when the clouds are to blame", () => {
    expect(verdict(meta({ state: "no_synthesis", intensity: null, cloudDegraded: true }), "en").hint)
      .toBe(DAY_COPY.en.cloudDegradedFull);
    expect(verdict(meta({ state: "no_synthesis", intensity: null, cloudDegraded: false }), "en").hint)
      .toBe(DAY_COPY.en.noWindowHint);
  });
});

describe("stats", () => {
  it("shows UV, window, time needed and the countdown while the sun is usable", () => {
    const labels = stats(meta(), "en").map((s) => s.label);
    expect(labels).toEqual([
      DAY_COPY.en.currentUVI, DAY_COPY.en.nowWindow, DAY_COPY.en.nowTimeNeeded, DAY_COPY.en.nowClosesIn,
    ]);
  });

  it("swaps the countdown for the best hour when the window has not opened", () => {
    const labels = stats(meta({ state: "upcoming", intensity: null, minutesUntilWindow: 60 }), "en").map((s) => s.label);
    expect(labels).toContain(DAY_COPY.en.nowBestHour);
    expect(labels).not.toContain(DAY_COPY.en.nowClosesIn);
  });

  it("shows nothing on a day with no window at all", () => {
    // A UV reading and an empty window would be noise around a verdict that has
    // already said everything.
    expect(stats(meta({ state: "no_synthesis", intensity: null }), "en")).toEqual([]);
  });

  it("drops a stat whose value is missing rather than printing a blank", () => {
    const labels = stats(meta({ minutesNeeded: null, windowClosesInMinutes: null }), "en").map((s) => s.label);
    expect(labels).toEqual([DAY_COPY.en.currentUVI, DAY_COPY.en.nowWindow]);
  });
});

describe("renderDay", () => {
  it("puts the answer in words first, and draws no chart", () => {
    const html = renderDay({ meta: meta(), locale: "es" });
    expect(html).toContain(DAY_COPY.es.nowOptimalTitle);
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<path");
  });

  it("colours the status dot per verdict, matching the app's palette", () => {
    expect(renderDay({ meta: meta({ intensity: "optimal" }), locale: "en" })).toContain("#5fd39b");
    expect(renderDay({ meta: meta({ intensity: "moderate" }), locale: "en" })).toContain("#fbbf24");
    expect(renderDay({ meta: meta({ state: "no_synthesis", intensity: null }), locale: "en" })).toContain("#f87171");
  });

  it("says so when nothing arrived", () => {
    expect(renderDay({ meta: null, locale: "es", emptyText: emptyText("es") })).toContain("No se recibió");
  });

  it("escapes copy instead of trusting it", () => {
    expect(renderDay({ meta: meta(), locale: "en" })).not.toContain("<script");
  });
});

describe("readDayMeta", () => {
  it("keeps intensity, which is what separates 'perfect' from 'usable'", () => {
    expect(readDayMeta(wrap(base))?.intensity).toBe("optimal");
    expect(readDayMeta(wrap({ ...base, intensity: "moderate" }))?.intensity).toBe("moderate");
    expect(readDayMeta(wrap({ ...base, intensity: "excellent" }))?.intensity).toBeNull();
  });

  it("refuses a payload with no UV reading", () => {
    expect(readDayMeta(wrap({ ...base, uvIndex: "high" }))).toBeNull();
    expect(readDayMeta(null)).toBeNull();
  });

  it("keeps nulls as nulls instead of inventing zeros", () => {
    const m = readDayMeta(wrap({ ...base, minutesNeeded: null, bestHour: null }));
    expect(m?.minutesNeeded).toBeNull();
    expect(m?.bestHour).toBeNull();
  });
});

describe("copy coverage", () => {
  it("has every verdict in all six languages", () => {
    for (const locale of WIDGET_LOCALES) {
      for (const key of ["nowOptimalTitle", "nowModerateTitle", "nowUpcomingTitle", "nowClosedTitle", "noWindowToday"] as const) {
        expect(DAY_COPY[locale][key].length, `${locale}/${key}`).toBeGreaterThan(0);
      }
      expect(emptyText(locale).length, locale).toBeGreaterThan(0);
    }
  });

  it("maps host locales onto what we speak", () => {
    expect(resolveWidgetLocale("es-419")).toBe("es");
    expect(resolveWidgetLocale("pt-BR")).toBe("en");
  });
});
