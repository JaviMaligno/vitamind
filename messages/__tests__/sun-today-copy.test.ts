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
import { cityYearProfile, contiguousMonthRange } from "@/lib/city-content";
import { doyFromMonthDay } from "@/lib/solar";
import { sunTodayData, sunTodayCopy } from "@/lib/sun-today";

const LOCALES = { es, en, fr, de, ru, lt } as Record<string, { sunToday: Record<string, string> }>;

/**
 * The city hub's copy. Everything the SERVER renders is in `SERVER_KEYS`; the
 * two `CLIENT_KEYS` are the only strings allowed to name a calendar date,
 * because only the browser knows which day it is when the page is read.
 */
const SERVER_KEYS = [
  "eyebrow", "title",
  "metaTitle", "metaTitleNone", "metaTitlePolar",
  "metaDescription", "metaDescriptionNone", "metaDescriptionPolar",
  "lede", "ledeNone", "ledePolar",
  "windowLabel", "noWindowLabel", "minutesLabel", "minutesValue",
  "clearSky", "changesHeading", "changesBody",
  "faqHeading",
  "faqWindowQ", "faqWindowASynthesis", "faqWindowANone", "faqWindowAPolar",
  "faqSunQ", "faqSunA", "faqSunAPolar",
  "faqYearQ", "faqYearARange", "faqYearAAll", "faqYearANever",
  "hubLink",
];

const CLIENT_KEYS = ["todayIs", "recomputed"];
const ALL_KEYS = [...SERVER_KEYS, ...CLIENT_KEYS];

/** Every ICU argument name in a message, including inside select/plural branches. */
const args = (message: string): string[] => {
  const found = new Set<string>();
  const walk = (nodes: ReturnType<typeof parse>): void => {
    for (const node of nodes) {
      if ("value" in node && typeof node.value === "string" && node.type !== 0) found.add(node.value);
      if ("options" in node && node.options) for (const opt of Object.values(node.options)) walk(opt.value);
      if ("children" in node && node.children) walk(node.children);
    }
  };
  walk(parse(message));
  return [...found].sort();
};

describe("sunToday copy", () => {
  it.each(Object.keys(LOCALES))("%s defines every key with real text", (locale) => {
    const ns = LOCALES[locale].sunToday;
    expect(ALL_KEYS.filter((k) => typeof ns?.[k] !== "string" || ns[k].trim() === "")).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s parses as valid ICU everywhere", (locale) => {
    for (const [key, value] of Object.entries(LOCALES[locale].sunToday)) {
      expect(() => parse(value), `${locale}.${key}`).not.toThrow();
    }
  });

  /**
   * The freshness contract, as a test. A server-rendered page cannot know which
   * day it is being read on, so no string it renders may name one. Only
   * `todayIs`, rendered in the browser after mount, takes a date.
   */
  it.each(Object.keys(LOCALES))("%s names a date only in the client-rendered string", (locale) => {
    for (const key of SERVER_KEYS) {
      expect(args(LOCALES[locale].sunToday[key]), `${locale}.${key}`).not.toContain("date");
    }
    expect(args(LOCALES[locale].sunToday.todayIs)).toContain("date");
  });

  it.each(Object.keys(LOCALES))("%s promises the vitamin D window, not a clock time", (locale) => {
    // The AI Overview already answers "what time is sunrise". The title exists
    // to promise the one thing no ephemeris rival carries.
    expect(LOCALES[locale].sunToday.metaTitle).toMatch(/vitamin|витамин/i);
  });

  it("gives ru and lt genuine plural categories for the minutes figure", () => {
    // Real values include 4, 8, 22, 57, 72, 117 — the categories differ.
    for (const locale of ["ru", "lt"]) {
      for (const key of ["minutesValue", "lede", "metaDescription", "faqWindowASynthesis"]) {
        const message = LOCALES[locale].sunToday[key];
        for (const category of ["one", "few", "many", "other"]) {
          expect(message, `${locale}.${key} lacks the ${category} plural`).toContain(`${category} {`);
        }
      }
    }
  });
});

describe("the page supplies every placeholder each locale declares", () => {
  const city = (slug: string) => BUILTIN_CITIES.find((x) => x.id === `builtin:${slug}`)!;
  const copyFor = (slug: string, monthIndex: number) => {
    const c = city(slug);
    const profile = cityYearProfile(c.lat, c.lon, c.elevation ?? 0);
    return sunTodayCopy({
      locale: "es",
      cityName: "Ciudad",
      data: sunTodayData(c, { year: 2026, monthIndex, day: 16, doy: doyFromMonthDay(monthIndex, 16) }),
      profile,
      band: contiguousMonthRange(profile.possibleMonths),
    });
  };

  /** Values the page passes directly, outside `sunTodayCopy`'s key/value pairs. */
  const PAGE_VALUES: Record<string, string[]> = {
    eyebrow: [],
    title: ["city"],
    windowLabel: [], noWindowLabel: [], minutesLabel: [], clearSky: [],
    minutesValue: ["minutes"],
    changesHeading: [], changesBody: ["city"],
    hubLink: ["city"],
    todayIs: ["date"],
    recomputed: ["city"],
  };

  const supplied = new Map<string, string[]>(Object.entries(PAGE_VALUES));
  for (const [slug, month] of [["madrid", 7], ["oslo", 11], ["singapur", 0], ["reikiavik", 5]] as const) {
    const copy = copyFor(slug, month);
    supplied.set(copy.metaTitleKey, Object.keys(copy.metaValues));
    supplied.set(copy.metaDescriptionKey, Object.keys(copy.metaValues));
    supplied.set(copy.ledeKey, Object.keys(copy.ledeValues));
    supplied.set("faqHeading", Object.keys(copy.headingValues));
    for (const entry of copy.faq) {
      supplied.set(entry.qKey, Object.keys(entry.qValues));
      supplied.set(entry.aKey, Object.keys(entry.aValues));
    }
  }

  it("reaches every key the namespace declares", () => {
    // Two families of variant cannot be reached by a fixture drawn from the 40
    // shipped cities, and both are pinned here so the list cannot quietly grow:
    // the POLAR ones (Tromso is deliberately absent from SUNRISE_CITIES), and
    // `faqYearANever` (no shipped city fails to synthesise in every month —
    // Reykjavik at 64.1 N still has a summer). Their formatting is covered by
    // the test below, which renders every key in every locale.
    const unreached = ALL_KEYS.filter((k) => !supplied.has(k));
    expect(unreached).toEqual([
      "metaTitlePolar", "metaDescriptionPolar", "ledePolar",
      "faqWindowAPolar", "faqSunAPolar", "faqYearANever",
    ]);
  });

  it.each(Object.keys(LOCALES))("%s asks for nothing the page does not pass", (locale) => {
    for (const [key, provided] of supplied) {
      const declared = args(LOCALES[locale].sunToday[key]);
      expect(declared.filter((a) => !provided.includes(a)), `${locale}.${key}`).toEqual([]);
    }
  });

  /**
   * Formatting is where a plural without `few`/`many` actually breaks — the ru
   * round that shipped "73 городов" parsed fine.
   */
  it.each(Object.keys(LOCALES))("%s formats every string with the page's own values", (locale) => {
    const values: Record<string, string | number> = {
      city: "Ciudad", date: "16 de agosto de 2026",
      windowStart: "11:00", windowEnd: "19:00",
      sunrise: "07:26", sunset: "21:12", dayLength: "13 h 46 min",
      startMonth: "marzo", endMonth: "octubre", fromMonth: "de marzo", fromMonthCap: "De marzo",
    };
    for (const key of ALL_KEYS) {
      const message = LOCALES[locale].sunToday[key];
      for (const minutes of [1, 2, 4, 8, 21, 22, 57, 72, 117]) {
        const out = new IntlMessageFormat(message, locale).format({ ...values, minutes });
        expect(typeof out, `${locale}.${key}`).toBe("string");
        expect(out as string, `${locale}.${key}`).not.toMatch(/[{}]/);
      }
    }
  });
});
