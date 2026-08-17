import { describe, it, expect } from "vitest";
import { parse } from "@formatjs/icu-messageformat-parser";
import IntlMessageFormat from "intl-messageformat";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";
import { BUILTIN_CITIES } from "@/lib/cities";
import { monthData, sunPageCopy } from "@/lib/sun-copy";

/**
 * The sunrise pages' metadata and FAQ have three regimes, and a missing variant
 * does not fail the build — next-intl renders the key name into a <title>. The
 * `minutes` plural is the other trap: a previous round shipped an agrammatical
 * Russian genitive because the string had no `few`/`many`, so the placeholder
 * sets are compared across locales rather than eyeballed.
 */
const LOCALES = { es, en, fr, de, ru, lt } as Record<
  string,
  { sunrisePage: Record<string, string> }
>;

const NEW_KEYS = [
  "metaTitleNone", "metaTitlePolar", "metaDescriptionNone", "metaDescriptionPolar",
  "faqHeading",
  "faqDeltaQ", "faqDeltaA",
  "faqLightQ", "faqLightA",
  "faqDawnQ", "faqDawnA", "faqDawnANoNight",
  "faqDarkQ", "faqDarkA", "faqDarkANoNight",
  "faqVitdQ", "faqVitdASynthesis", "faqVitdANone", "faqVitdAPolar",
  "faqPolarQ", "faqPolarA",
];

/** Keys the new FAQ replaces. faqSunriseA's figures live in faqDeltaA now. */
const REMOVED_KEYS = ["faqSunriseQ", "faqSunriseA", "faqDayQ", "faqDayA"];

/** Every ICU argument name in a message, including inside select/plural branches. */
const args = (message: string): string[] => {
  const found = new Set<string>();
  const walk = (nodes: ReturnType<typeof parse>): void => {
    for (const node of nodes) {
      if ("value" in node && typeof node.value === "string" && node.type !== 0) found.add(node.value);
      if ("options" in node && node.options) {
        for (const opt of Object.values(node.options)) walk(opt.value);
      }
      if ("children" in node && node.children) walk(node.children);
    }
  };
  walk(parse(message));
  return [...found].sort();
};

describe("sunrisePage regime copy", () => {
  it.each(Object.keys(LOCALES))("%s defines every new key with real text", (locale) => {
    const ns = LOCALES[locale].sunrisePage;
    const missing = NEW_KEYS.filter((k) => typeof ns[k] !== "string" || ns[k].trim() === "");
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s drops the keys the new FAQ replaces", (locale) => {
    const ns = LOCALES[locale].sunrisePage;
    expect(REMOVED_KEYS.filter((k) => k in ns)).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s stops promising exact times and names the differentiator", (locale) => {
    // The AI Overview already satisfies "exact times"; the synthesis-regime
    // title exists to promise the one thing no ephemeris rival carries.
    expect(LOCALES[locale].sunrisePage.metaTitle).toMatch(/vitamin|витамин/i);
  });

  it.each(Object.keys(LOCALES))("%s parses as valid ICU in every sunrisePage key", (locale) => {
    for (const [key, value] of Object.entries(LOCALES[locale].sunrisePage)) {
      expect(() => parse(value), `${locale}.${key}`).not.toThrow();
    }
  });

  it.each(["en", "fr", "de", "ru", "lt"])("%s uses exactly the placeholders es uses", (locale) => {
    for (const key of [...NEW_KEYS, "metaTitle", "metaDescription"]) {
      expect(args(LOCALES[locale].sunrisePage[key]), `${locale}.${key}`).toEqual(
        args(es.sunrisePage[key as keyof typeof es.sunrisePage] as string),
      );
    }
  });

  it("gives ru and lt genuine plural categories for the minutes figure", () => {
    // Real values include 4, 8, 22, 57, 72, 117 — the categories differ.
    for (const locale of ["ru", "lt"]) {
      for (const key of ["faqDeltaA", "faqVitdASynthesis"]) {
        const message = LOCALES[locale].sunrisePage[key];
        for (const category of ["one", "few", "many", "other"]) {
          expect(message, `${locale}.${key} lacks the ${category} plural`).toContain(`${category} {`);
        }
      }
    }
  });
});

describe("the page supplies every placeholder the Spanish source declares", () => {
  const city = (slug: string) => BUILTIN_CITIES.find((x) => x.id === `builtin:${slug}`)!;
  const copyFor = (slug: string, monthIndex: number) => {
    const c = city(slug);
    return sunPageCopy({
      cityName: "Ciudad",
      month: "mes",
      data: monthData(c.lat, c.lon, c.tz, c.timezone, c.elevation ?? 0, monthIndex),
    });
  };

  // One fixture per regime, plus the white-night pair.
  const supplied = new Map<string, string[]>();
  for (const [slug, month] of [["madrid", 7], ["madrid", 11], ["tromso", 5], ["reikiavik", 5]] as const) {
    const copy = copyFor(slug, month);
    supplied.set(copy.metaTitleKey, Object.keys(copy.metaValues));
    supplied.set(copy.metaDescriptionKey, Object.keys(copy.metaValues));
    supplied.set("faqHeading", Object.keys(copy.headingValues));
    for (const entry of copy.faq) {
      supplied.set(entry.qKey, Object.keys(entry.qValues));
      supplied.set(entry.aKey, Object.keys(entry.aValues));
    }
  }

  it("covers all three metadata variants and every FAQ answer", () => {
    expect([...supplied.keys()].sort()).toEqual(
      [...NEW_KEYS, "metaTitle", "metaDescription"].sort(),
    );
  });

  it.each([...NEW_KEYS, "metaTitle", "metaDescription"])("%s gets every value it asks for", (key) => {
    const declared = args(es.sunrisePage[key as keyof typeof es.sunrisePage] as string);
    const provided = supplied.get(key) ?? [];
    expect(declared.filter((a) => !provided.includes(a))).toEqual([]);
  });

  /**
   * Formatting is where a plural without `few`/`many` or a select without
   * `other` actually breaks — the ru round that shipped "73 городов" parsed
   * fine. Every string is rendered in every locale with the values the page
   * hands it, including the minutes figures real cities produce.
   */
  it.each(Object.keys(LOCALES))("%s formats every new string with the page's own values", (locale) => {
    const values: Record<string, string | number> = {
      city: "Ciudad", month: "mes",
      firstSunrise: "07:26", firstSunset: "21:26", lastSunrise: "08:00", lastSunset: "20:14",
      sunrise: "07:26", sunset: "21:12", dawn: "06:57", dusk: "21:41",
      dayLength: "13 h 46 min", days: 31, lastDay: 31,
      windowStart: "11:00", windowEnd: "19:00",
    };
    for (const key of [...NEW_KEYS, "metaTitle", "metaDescription"]) {
      const message = LOCALES[locale].sunrisePage[key];
      for (const trend of ["shorter", "longer", "other"]) {
        for (const minutes of [1, 2, 4, 8, 21, 22, 57, 72, 117]) {
          const out = new IntlMessageFormat(message, locale).format({ ...values, trend, minutes });
          expect(typeof out, `${locale}.${key}`).toBe("string");
          expect(out as string, `${locale}.${key}`).not.toMatch(/[{}]/);
        }
      }
    }
  });
});
