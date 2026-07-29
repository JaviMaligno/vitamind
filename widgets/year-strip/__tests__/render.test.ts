import { describe, it, expect } from "vitest";
import { HEAT_HIGH, HEAT_LOW } from "@/lib/year-strip";
import { renderYearStrip } from "../render";
import { widgetPalette, resolveWidgetTheme } from "../theme";
import { widgetStrings } from "../i18n";

const year = Array.from({ length: 365 }, (_, i) => (i % 11));
const countRects = (html: string) => (html.match(/<rect\b/g) ?? []).length;

describe("renderYearStrip with data", () => {
  it("draws one bar per day — 365 for a full year", () => {
    const html = renderYearStrip({ hoursByDay: year, locale: "en", theme: "light" });
    expect(countRects(html)).toBe(365);
  });

  it("colours the bars with the shared ramp", () => {
    const html = renderYearStrip({ hoursByDay: [0, 10], locale: "en", theme: "light" });
    expect(html).toContain(HEAT_LOW);
    expect(html).toContain(HEAT_HIGH);
  });

  it("sizes the viewBox from the data so a 366-day array still fits", () => {
    expect(renderYearStrip({ hoursByDay: year, locale: "en", theme: "dark" }))
      .toContain('viewBox="0 0 365 110"');
    expect(renderYearStrip({ hoursByDay: new Array(366).fill(1), locale: "en", theme: "dark" }))
      .toContain('viewBox="0 0 366 110"');
  });

  it("labels the months and the legend in the host's language", () => {
    const ru = renderYearStrip({ hoursByDay: year, locale: "ru", theme: "light" });
    expect(ru).toContain(widgetStrings("ru").caption);
    expect(ru).toContain("0 ч");
    expect(ru).toContain("10 ч+");

    const lt = renderYearStrip({ hoursByDay: year, locale: "lt", theme: "light" });
    expect(lt).toContain("saus.");
    expect(lt).toContain("gruod.");
  });

  it("escapes text so a translation can never inject markup", () => {
    const html = renderYearStrip({ hoursByDay: year, locale: "fr", theme: "light" });
    // fr's caption contains an apostrophe; it must survive as text, and no
    // stray unescaped angle bracket may appear in a text node.
    expect(html).toContain("d&#39;heures");
    expect(html).not.toContain("<script");
  });
});

describe("renderYearStrip empty state", () => {
  it("draws no bars and says why when there is no data", () => {
    const html = renderYearStrip({ hoursByDay: null, locale: "en", theme: "light" });
    expect(countRects(html)).toBe(0);
    expect(html).toContain(widgetStrings("en").empty);
  });

  it("localises the empty state too", () => {
    const html = renderYearStrip({ hoursByDay: null, locale: "de", theme: "dark" });
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
    const light = renderYearStrip({ hoursByDay: year, locale: "en", theme: "light" });
    const dark = renderYearStrip({ hoursByDay: year, locale: "en", theme: "dark" });
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
