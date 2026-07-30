import { describe, expect, it } from "vitest";
import { readDayCurveMeta, DAY_CURVE_META_KEY, type DayCurveMeta } from "../data";
import { renderDayCurve, fmtHours } from "../render";
import { dayCurveStrings, resolveWidgetLocale, WIDGET_LOCALES } from "../i18n";

const elevations = Array.from({ length: 97 }, (_, i) => 60 * Math.sin((Math.PI * i) / 96) - 10);

const meta = (over: Partial<DayCurveMeta> = {}): DayCurveMeta => ({
  elevations,
  stepMinutes: 15,
  thresholdElevation: 25,
  nowLocalHours: 13.5,
  windowStart: 10,
  windowEnd: 16,
  state: "good_now",
  uvIndex: 6.4,
  minutesNeeded: 14,
  cloudCoverPercent: 20,
  ...over,
});

const wrap = (chart: unknown) => ({ content: [], _meta: { [DAY_CURVE_META_KEY]: chart } });

describe("readDayCurveMeta", () => {
  it("accepts a well-formed payload", () => {
    expect(readDayCurveMeta(wrap(meta()))?.elevations).toHaveLength(97);
  });

  it("rejects anything that is not a usable chart", () => {
    expect(readDayCurveMeta(null)).toBeNull();
    expect(readDayCurveMeta({})).toBeNull();
    expect(readDayCurveMeta({ _meta: {} })).toBeNull();
    expect(readDayCurveMeta(wrap({ elevations: [] }))).toBeNull();
    expect(readDayCurveMeta(wrap({ elevations: [1, 2] }))).toBeNull(); // no threshold
    expect(readDayCurveMeta(wrap({ ...meta(), elevations: [1, "x", 3] }))).toBeNull();
    expect(readDayCurveMeta(wrap({ ...meta(), elevations: Array(400).fill(1) }))).toBeNull();
  });

  it("falls back to the safest state rather than trusting an unknown one", () => {
    expect(readDayCurveMeta(wrap({ ...meta(), state: "party_time" }))?.state).toBe("no_synthesis");
  });

  it("keeps nulls as nulls instead of inventing zeros", () => {
    const read = readDayCurveMeta(wrap({ ...meta(), minutesNeeded: null, cloudCoverPercent: null }));
    expect(read?.minutesNeeded).toBeNull();
    expect(read?.cloudCoverPercent).toBeNull();
  });
});

describe("fmtHours", () => {
  it("formats decimal hours, rounding minutes without producing :60", () => {
    expect(fmtHours(9)).toBe("09:00");
    expect(fmtHours(13.5)).toBe("13:30");
    expect(fmtHours(7.999)).toBe("08:00");
  });
});

describe("renderDayCurve", () => {
  it("shows the empty state when no chart arrived", () => {
    const html = renderDayCurve({ meta: null, locale: "es" });
    expect(html).toContain("No se recibió");
    expect(html).not.toContain("<svg");
  });

  it("draws the curve, the viable band, the threshold and the now marker", () => {
    const html = renderDayCurve({ meta: meta(), locale: "en" });
    expect(html).toContain("<svg");
    expect(html).toContain("<path");
    expect(html).toContain("stroke-dasharray"); // threshold line
    expect((html.match(/<rect/g) ?? [])).toHaveLength(1); // the shaded band
    expect((html.match(/<line/g) ?? [])).toHaveLength(2); // threshold + now
  });

  it("omits the now marker when the host gave no clock", () => {
    const html = renderDayCurve({ meta: meta({ nowLocalHours: null }), locale: "en" });
    expect((html.match(/<line/g) ?? [])).toHaveLength(1);
  });

  it("omits the band on a day that never clears the threshold", () => {
    const flat = Array.from({ length: 97 }, () => 2);
    const html = renderDayCurve({ meta: meta({ elevations: flat, state: "no_synthesis" }), locale: "en" });
    expect(html).not.toContain("<rect");
  });

  it("headlines the verdict in the host's language", () => {
    expect(renderDayCurve({ meta: meta(), locale: "es" })).toContain("Ahora mismo hay buen sol");
    expect(renderDayCurve({ meta: meta(), locale: "de-DE" })).toContain("Gerade jetzt gute Sonne");
    expect(renderDayCurve({ meta: meta({ state: "window_closed" }), locale: "fr" }))
      .toContain("La fenêtre du jour est fermée");
  });

  it("colours the verdict by state, not by theme", () => {
    const good = renderDayCurve({ meta: meta({ state: "good_now" }), locale: "en" });
    const closed = renderDayCurve({ meta: meta({ state: "window_closed" }), locale: "en" });
    expect(good).toContain("#ffb020");
    expect(closed).not.toContain("#ffb020");
  });

  it("adapts the surrounding text to the host theme", () => {
    const light = renderDayCurve({ meta: meta(), locale: "en", theme: "light" });
    const dark = renderDayCurve({ meta: meta(), locale: "en", theme: "dark" });
    expect(light).not.toBe(dark);
  });

  it("escapes nothing dangerous into the document", () => {
    // Everything rendered comes from our own server, but the widget is a page:
    // if a string ever carried markup it must not become markup.
    const html = renderDayCurve({ meta: meta(), locale: "en" });
    expect(html).not.toContain("<script");
  });
});

describe("widget copy", () => {
  it("covers every state in all six languages", () => {
    for (const locale of WIDGET_LOCALES) {
      const copy = dayCurveStrings(locale);
      for (const state of ["good_now", "upcoming", "window_closed", "no_synthesis"] as const) {
        expect(copy.headline[state].length, `${locale}/${state}`).toBeGreaterThan(0);
      }
    }
  });

  it("maps host locales to what we actually speak", () => {
    expect(resolveWidgetLocale("es-419")).toBe("es");
    expect(resolveWidgetLocale("LT")).toBe("lt");
    expect(resolveWidgetLocale("pt-BR")).toBe("en");
    expect(resolveWidgetLocale(undefined)).toBe("en");
  });
});
