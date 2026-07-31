import { describe, it, expect } from "vitest";
import { HEAT_HIGH, HEAT_LOW } from "@/lib/year-strip";
import { renderYearStrip, yearHeadline } from "../render";
import { widgetPalette, resolveWidgetTheme } from "../theme";
import { widgetStrings } from "../i18n";

const year = Array.from({ length: 365 }, (_, i) => (i % 11));
const countRects = (html: string) => (html.match(/<rect\b/g) ?? []).length;

describe("renderYearStrip with data", () => {
  it("draws one bar per day — 365 for a full year", () => {
    const html = renderYearStrip({ places: [{ hoursByDay: year }], locale: "en", theme: "light" });
    expect(countRects(html)).toBe(365);
  });

  it("colours the bars with the shared ramp", () => {
    const html = renderYearStrip({ places: [{ hoursByDay: [0, 10] }], locale: "en", theme: "light" });
    expect(html).toContain(HEAT_LOW);
    expect(html).toContain(HEAT_HIGH);
  });

  it("sizes the viewBox from the data so a 366-day array still fits", () => {
    expect(renderYearStrip({ places: [{ hoursByDay: year }], locale: "en", theme: "dark" }))
      .toContain('viewBox="0 0 365 110"');
    expect(renderYearStrip({ places: [{ hoursByDay: new Array(366).fill(1) }], locale: "en", theme: "dark" }))
      .toContain('viewBox="0 0 366 110"');
  });

  it("labels the months and the legend in the host's language", () => {
    const ru = renderYearStrip({ places: [{ hoursByDay: year }], locale: "ru", theme: "light" });
    expect(ru).toContain(widgetStrings("ru").caption);
    expect(ru).toContain("0 ч");
    expect(ru).toContain("10 ч+");

    const lt = renderYearStrip({ places: [{ hoursByDay: year }], locale: "lt", theme: "light" });
    expect(lt).toContain("saus.");
    expect(lt).toContain("gruod.");
  });

  it("escapes text so a translation can never inject markup", () => {
    const html = renderYearStrip({ places: [{ hoursByDay: year }], locale: "fr", theme: "light" });
    // fr's caption contains an apostrophe; it must survive as text, and no
    // stray unescaped angle bracket may appear in a text node.
    expect(html).toContain("d&#39;heures");
    expect(html).not.toContain("<script");
  });
});

describe("renderYearStrip empty state", () => {
  it("draws no bars and says why when there is no data", () => {
    const html = renderYearStrip({ places: null, locale: "en", theme: "light" });
    expect(countRects(html)).toBe(0);
    expect(html).toContain(widgetStrings("en").empty);
  });

  it("localises the empty state too", () => {
    const html = renderYearStrip({ places: null, locale: "de", theme: "dark" });
    expect(html).toContain(widgetStrings("de").empty);
  });
});

describe("theme", () => {
  it("resolves the host's theme, defaulting to light", () => {
    expect(resolveWidgetTheme("dark")).toBe("dark");
    expect(resolveWidgetTheme("light")).toBe("light");
    expect(resolveWidgetTheme(undefined)).toBe("light");
    expect(resolveWidgetTheme("neon")).toBe("light");
  });

  it("changes the chrome colours between light and dark", () => {
    const light = widgetPalette("light");
    const dark = widgetPalette("dark");
    expect(dark.pageBackground).not.toBe(light.pageBackground);
    expect(dark.textPrimary).not.toBe(light.textPrimary);
    expect(dark.textMuted).not.toBe(light.textMuted);
  });

  it("keeps the plate dark in BOTH themes — the ramp is calibrated for it", () => {
    // HEAT_LOW is nearly black. On a white plate the strip would read as a
    // smudge, so the plate never follows the host theme.
    expect(widgetPalette("light").plate).toBe(widgetPalette("dark").plate);
    expect(widgetPalette("light").onPlateFaint).toBe(widgetPalette("dark").onPlateFaint);
    expect(widgetPalette("light").onPlateFaint).toBe("rgba(255,255,255,0.55)");
  });

  it("renders different markup under a dark host theme", () => {
    const light = renderYearStrip({ places: [{ hoursByDay: year }], locale: "en", theme: "light" });
    const dark = renderYearStrip({ places: [{ hoursByDay: year }], locale: "en", theme: "dark" });
    expect(dark).not.toBe(light);
    expect(light).toContain(widgetPalette("light").textPrimary);
    expect(dark).toContain(widgetPalette("dark").textPrimary);
    // …but the bars themselves are identical in both themes.
    expect(countRects(light)).toBe(countRects(dark));
    expect(dark).toContain(widgetPalette("dark").plate);
    expect(light).toContain(widgetPalette("light").plate);
  });

  it("prefers the host's own CSS variables when it supplies them", () => {
    // McpUiStyles is Record<key, string|undefined>: every var needs a fallback.
    const p = widgetPalette("light");
    expect(p.pageBackground).toContain("var(--color-background-primary,");
    expect(p.textPrimary).toContain("var(--color-text-primary,");
  });
});

describe("renderYearStrip stacked (comparison)", () => {
  const flat = (h: number) => new Array(365).fill(h);

  it("draws one strip per place, each labelled", () => {
    const html = renderYearStrip({
      places: [
        { name: "Reykjavik", hoursByDay: flat(1), spanStart: "04-30", spanEnd: "08-23" },
        { name: "Singapore", hoursByDay: flat(9) },
      ],
      locale: "en",
      theme: "dark",
    });
    expect((html.match(/<svg/g) ?? [])).toHaveLength(2);
    expect(html).toContain("Reykjavik");
    expect(html).toContain("Singapore");
    expect(html).toContain("04-30");
  });

  it("shares one month axis and one legend across the stack", () => {
    // The comparison only means something if every strip is the same 365 days
    // on the same axis; repeating the axis per strip would invite the opposite
    // reading.
    const html = renderYearStrip({
      places: [
        { name: "A", hoursByDay: flat(1) },
        { name: "B", hoursByDay: flat(2) },
        { name: "C", hoursByDay: flat(3) },
      ],
      locale: "en",
    });
    expect((html.match(/repeat\(12,1fr\)/g) ?? [])).toHaveLength(1);
    expect((html.match(/linear-gradient/g) ?? [])).toHaveLength(1);
  });

  it("shrinks the strips when there is more than one", () => {
    const one = renderYearStrip({ places: [{ hoursByDay: flat(4) }], locale: "en" });
    const two = renderYearStrip({
      places: [{ name: "A", hoursByDay: flat(4) }, { name: "B", hoursByDay: flat(4) }],
      locale: "en",
    });
    expect(one).toContain('height="110"');
    expect(two).toContain('height="56"');
  });

  it("keeps a place name from becoming markup", () => {
    const html = renderYearStrip({
      places: [{ name: "<img src=x onerror=alert(1)>", hoursByDay: flat(3) }],
      locale: "en",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("yearHeadline — the answer before the picture", () => {
  const base = { allYear: false, neverPossible: false, monthsWithSun: 5 };

  it("states the season in the app's own words when the place is named", () => {
    expect(yearHeadline({ ...base, name: "Reikiavik", spanStart: "30 abr", spanEnd: "23 ago" }, "es"))
      .toBe("En Reikiavik puedes sintetizar vitamina D de 30 abr a 23 ago.");
  });

  it("uses the all-year and never sentences where they apply", () => {
    expect(yearHeadline({ ...base, name: "Singapur", allYear: true }, "es"))
      .toContain("durante todo el año");
    expect(yearHeadline({ ...base, name: "Tromsø", neverPossible: true }, "es"))
      .toContain("nunca alcanza");
  });

  it("falls back to the span alone when nobody named the place", () => {
    // The app's copy is written around a city name; without one there is no
    // sentence to build, so state the fact rather than invent a phrasing.
    expect(yearHeadline({ ...base, spanStart: "24 mar", spanEnd: "27 sep" }, "es"))
      .toBe("24 mar → 27 sep");
  });

  it("says nothing rather than something empty", () => {
    expect(yearHeadline(null, "es")).toBeNull();
    expect(yearHeadline({ ...base }, "es")).toBeNull();
  });

  it("leaves no unfilled placeholders", () => {
    const h = yearHeadline({ ...base, name: "Oslo", spanStart: "23 abr", spanEnd: "29 ago" }, "de");
    expect(h).not.toContain("{");
  });

  it("puts the headline above the strip, and only for a single place", () => {
    const year = new Array(365).fill(4);
    const single = renderYearStrip({
      places: [{ hoursByDay: year }],
      verdict: { ...base, name: "Madrid", spanStart: "14 feb", spanEnd: "2 nov" },
      locale: "es",
    });
    expect(single.indexOf("Madrid")).toBeLessThan(single.indexOf("<svg"));

    // A comparison captions each strip already; one headline cannot speak for five.
    const many = renderYearStrip({
      places: [{ name: "A", hoursByDay: year }, { name: "B", hoursByDay: year }],
      verdict: null,
      locale: "es",
    });
    expect(many).not.toContain("puedes sintetizar");
  });
});
