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
import { sunTodayData, sunTodayCopy, todayWindowCopy } from "@/lib/sun-today";

const LOCALES = { es, en, fr, de, ru, lt } as Record<string, { sunToday: Record<string, string> }>;

/**
 * The city hub's copy, split by WHO CAN STILL BE WRONG ABOUT IT.
 *
 * `FROZEN_KEYS` are rendered by the server into surfaces no browser ever
 * revisits: the `<title>`/meta description a search engine quotes, and the FAQ
 * answer handed to Google as structured data. ISR puts no upper bound on the
 * age of that HTML — it is as old as the last request that triggered a
 * regeneration, which for 240 low-traffic URLs is days or weeks — so any figure
 * in one of these is a claim the page cannot stand behind. They therefore state
 * criteria, never a day's figures.
 *
 * `LIVE_KEYS` are the strings `components/TodayWindow.tsx` and
 * `components/TodayFaq.tsx` recompute on mount from the city's own date. They
 * may carry day-specific figures because a reader always sees them corrected —
 * and because both components draw from ONE recomputation, they cannot
 * contradict each other on screen.
 */
const FROZEN_KEYS = [
  "eyebrow", "title",
  "metaTitle", "metaDescription",
  "windowLabel", "noWindowLabel", "minutesLabel",
  "clearSky", "changesHeading", "changesBody",
  "faqHeading",
  "faqWindowQ", "faqSunQ",
  "faqYearQ", "faqYearARange", "faqYearAAll", "faqYearANever",
  "hubLink",
];

const LIVE_KEYS = [
  "lede", "ledeNone", "ledePolar",
  "minutesValue",
  "faqWindowASynthesis", "faqWindowANone", "faqWindowAPolar",
  "faqSunA", "faqSunAPolar",
  "todayIs", "recomputed",
];
const ALL_KEYS = [...FROZEN_KEYS, ...LIVE_KEYS];

/** Arguments whose value is true of one particular day and no other. */
const DAY_ARGS = ["date", "windowStart", "windowEnd", "minutes", "sunrise", "sunset", "dayLength"];

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

  /**
   * An extra key is not harmless here: a regime-branched `metaTitleNone` is
   * exactly the string that let a cached page assert "no vitamin D today" for a
   * city with an eight-hour window. If a variant is not reachable it must not
   * exist.
   */
  it.each(Object.keys(LOCALES))("%s declares exactly the keys the page renders", (locale) => {
    expect(Object.keys(LOCALES[locale].sunToday).sort()).toEqual([...ALL_KEYS].sort());
  });

  it.each(Object.keys(LOCALES))("%s parses as valid ICU everywhere", (locale) => {
    for (const [key, value] of Object.entries(LOCALES[locale].sunToday)) {
      expect(() => parse(value), `${locale}.${key}`).not.toThrow();
    }
  });

  /**
   * The freshness contract, as a test.
   *
   * The earlier version of this test only forbade a `{date}` argument, which
   * missed the real hazard: "Between 12:00 and 16:00, today" is just as flatly
   * wrong as a wrong date when today has no window at all, and a cached
   * `metaDescription` saying so is what a search engine quotes and an AI
   * Overview ingests. Nothing the browser cannot correct may name a figure that
   * belongs to one day.
   */
  it.each(Object.keys(LOCALES))("%s keeps day-specific figures out of the uncorrectable strings", (locale) => {
    for (const key of FROZEN_KEYS) {
      const declared = args(LOCALES[locale].sunToday[key]);
      expect(declared.filter((a) => DAY_ARGS.includes(a)), `${locale}.${key}`).toEqual([]);
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
    // `metaDescription` is absent from this list because it no longer names a
    // minutes figure at all: the metadata states the criterion, not the day's
    // answer.
    for (const locale of ["ru", "lt"]) {
      for (const key of ["minutesValue", "lede", "faqWindowASynthesis"]) {
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
    metaTitle: ["city"], metaDescription: ["city"],
    windowLabel: [], noWindowLabel: [], minutesLabel: [], clearSky: [],
    minutesValue: ["minutes"],
    changesHeading: [], changesBody: ["city"],
    hubLink: ["city"],
    todayIs: ["date"],
    recomputed: ["city"],
  };

  const supplied = new Map<string, string[]>(Object.entries(PAGE_VALUES));
  for (const [slug, month] of [["madrid", 7], ["oslo", 11], ["singapur", 0], ["reikiavik", 5]] as const) {
    const c = city(slug);
    const copy = copyFor(slug, month);
    supplied.set("faqHeading", Object.keys(copy.headingValues));
    for (const entry of [...copy.dayFaq, copy.yearFaq]) {
      supplied.set(entry.qKey, Object.keys(entry.qValues));
      supplied.set(entry.aKey, Object.keys(entry.aValues));
    }
    // The lede and the panel go through `todayWindowCopy`, which is what both
    // client components render — the page never picks those keys itself.
    const day = todayWindowCopy(
      "Ciudad",
      sunTodayData(c, { year: 2026, monthIndex: month, day: 16, doy: doyFromMonthDay(month, 16) }),
    );
    supplied.set(day.ledeKey, Object.keys(day.values));
  }

  it("reaches every key the namespace declares", () => {
    // Two families of variant cannot be reached by a fixture drawn from the 40
    // shipped cities, and both are pinned here so the list cannot quietly grow:
    // the POLAR ones (Tromso is deliberately absent from SUNRISE_CITIES), and
    // `faqYearANever` (no shipped city fails to synthesise in every month —
    // Reykjavik at 64.1 N still has a summer). Their formatting is covered by
    // the test below, which renders every key in every locale.
    //
    // `metaTitle`/`metaDescription` no longer branch on regime at all, so the
    // polar and none variants of those are gone rather than unreachable.
    const unreached = ALL_KEYS.filter((k) => !supplied.has(k));
    expect(unreached).toEqual([
      "faqYearANever", "ledePolar", "faqWindowAPolar", "faqSunAPolar",
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
