import { describe, it, expect } from "vitest";
import {
  WIDGET_LOCALES,
  resolveWidgetLocale,
  widgetStrings,
  widgetMonthLabels,
} from "../i18n";

describe("resolveWidgetLocale", () => {
  it("accepts the six locales the app ships", () => {
    for (const l of WIDGET_LOCALES) expect(resolveWidgetLocale(l)).toBe(l);
  });

  it("reduces a regional tag to its base language", () => {
    // Hosts hand out BCP-47 tags like "en-US" or "es-419", never bare "es".
    expect(resolveWidgetLocale("en-US")).toBe("en");
    expect(resolveWidgetLocale("es-419")).toBe("es");
    expect(resolveWidgetLocale("fr-CA")).toBe("fr");
    expect(resolveWidgetLocale("LT-lt")).toBe("lt");
  });

  it("falls back to English for unsupported or missing tags", () => {
    expect(resolveWidgetLocale("ja")).toBe("en");
    expect(resolveWidgetLocale(undefined)).toBe("en");
    expect(resolveWidgetLocale(null)).toBe("en");
    expect(resolveWidgetLocale("")).toBe("en");
  });
});

describe("widgetStrings", () => {
  it("carries a caption, both legend ends and an empty-state line per locale", () => {
    for (const l of WIDGET_LOCALES) {
      const s = widgetStrings(l);
      expect(s.caption.length).toBeGreaterThan(10);
      expect(s.legendLow.length).toBeGreaterThan(0);
      expect(s.legendHigh.length).toBeGreaterThan(0);
      expect(s.empty.length).toBeGreaterThan(10);
    }
  });

  it("matches the wording the city pages already use", () => {
    expect(widgetStrings("en").caption)
      .toBe("Daily hours with enough sun to synthesize vitamin D across the year.");
    expect(widgetStrings("es").caption)
      .toBe("Horas diarias con sol suficiente para sintetizar vitamina D a lo largo del año.");
    // Russian localises the hour abbreviation; the others keep "h".
    expect(widgetStrings("ru").legendLow).toBe("0 ч");
    expect(widgetStrings("ru").legendHigh).toBe("10 ч+");
    expect(widgetStrings("de").legendLow).toBe("0 h");
  });

  it("resolves regional tags before looking the strings up", () => {
    expect(widgetStrings("es-AR").caption).toBe(widgetStrings("es").caption);
  });
});

describe("widgetMonthLabels", () => {
  it("gives twelve labels in every locale", () => {
    for (const l of WIDGET_LOCALES) expect(widgetMonthLabels(l)).toHaveLength(12);
  });

  it("uses alphabetic Lithuanian abbreviations, not CLDR's '01'..'12'", () => {
    const lt = widgetMonthLabels("lt");
    expect(lt[0]).toBe("saus.");
    expect(lt.every((m) => /[a-ząčęėįšųūž]/i.test(m))).toBe(true);
  });
});
