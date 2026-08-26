import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

const LOCALES = { es, en, fr, de, ru, lt } as Record<string, { cityPage: Record<string, string> }>;

/**
 * Verification contract §8.6 and the copy rule of §4.4.
 *
 * next-intl does not throw on a missing message: its default `getMessageFallback`
 * renders the literal `cityPage.viewNearestCityPage` into a page that returns 200.
 * So a locale that lacks the key ships gibberish, not an error — the key has to be
 * present in all six even while fr/de/ru/lt await native translation.
 */
describe("the two new chip keys exist in all six locales", () => {
  for (const key of ["viewNearestCityPage", "viewIndexInstead"]) {
    it(`cityPage.${key}`, () => {
      for (const [locale, msgs] of Object.entries(LOCALES)) {
        expect(typeof msgs.cityPage[key], `${locale}.cityPage.${key}`).toBe("string");
        expect(msgs.cityPage[key].trim().length).toBeGreaterThan(0);
      }
    });
  }
});

describe("the chip copy states no threshold of its own", () => {
  // Five stale numeric claims reached production by naming a figure in the message
  // files. These two keys are safe BY CONSTRUCTION: {km} is interpolated at render
  // time from lib/geo-distance.ts, and no threshold (75, 100, 400, 1000, 1500) is
  // ever spelled out. If a reviewer proposes adding one, it needs its own test.
  it("interpolates {city} and {km} rather than hard-coding a distance", () => {
    for (const [locale, msgs] of Object.entries(LOCALES)) {
      const near = msgs.cityPage.viewNearestCityPage ?? "";
      expect(near, `${locale}`).toContain("{city}");
      expect(near, `${locale}`).toContain("{km}");
    }
  });

  it("never names a threshold", () => {
    for (const [locale, msgs] of Object.entries(LOCALES)) {
      for (const key of ["viewNearestCityPage", "viewIndexInstead"]) {
        const raw = msgs.cityPage[key];
        expect(typeof raw, `${locale}.cityPage.${key}`).toBe("string");
        expect(raw.replace(/\{[^}]*\}/g, ""), `${locale}.cityPage.${key}`).not.toMatch(/\d/);
      }
    }
  });
});
