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
import { monthData, monthDirection, sunPageCopy } from "@/lib/sun-copy";
import { COMPASS_POINTS } from "@/lib/compass";
import type { CompassPoint } from "@/lib/compass";

/**
 * The sunrise pages' metadata and FAQ have three regimes, and a missing variant
 * does not fail the build — next-intl renders the key name into a <title>. The
 * `minutes` plural is the other trap: a previous round shipped an agrammatical
 * Russian genitive because the string had no `few`/`many`, so the placeholder
 * sets are compared across locales rather than eyeballed.
 */
const LOCALES = { es, en, fr, de, ru, lt } as Record<
  string,
  {
    sunrisePage: Record<string, string>;
    compass: { name: Record<string, string>; in: Record<string, string> };
  }
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

/**
 * The direction answer, phrased the way the query is typed ("por donde se pone
 * el sol en agosto"). It goes through `sunPageCopy` like every other FAQ entry,
 * so the placeholder-supply check below covers it.
 */
const DIRECTION_FAQ_KEYS = ["faqDirectionQ", "faqDirectionA"];

/** The visible section, rendered by the page rather than selected per regime. */
const DIRECTION_PAGE_KEYS = [
  "directionHeading", "directionBody", "directionNote",
  "directionRiseLabel", "directionSetLabel",
];

/** Every key whose ICU has to survive real values, in every locale. */
const ALL_KEYS = [
  ...NEW_KEYS, ...DIRECTION_FAQ_KEYS, ...DIRECTION_PAGE_KEYS, "metaTitle", "metaDescription",
];

/** The keys `sunPageCopy` picks between, which the page must supply values for. */
const SELECTED_KEYS = [...NEW_KEYS, ...DIRECTION_FAQ_KEYS, "metaTitle", "metaDescription"];

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
    const missing = ALL_KEYS.filter((k) => typeof ns[k] !== "string" || ns[k].trim() === "");
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
    for (const key of ALL_KEYS) {
      expect(args(LOCALES[locale].sunrisePage[key]), `${locale}.${key}`).toEqual(
        args(es.sunrisePage[key as keyof typeof es.sunrisePage] as string),
      );
    }
  });

  it("states TRUE north, which is what lib/solar.ts computes", () => {
    // `SunDirection` in lib/solar.ts is documented as "degrees clockwise from
    // true north". A phone compass shows MAGNETIC north, off by up to ~20° in
    // places, so a bearing offered without that word is a wrong instruction.
    const TRUE_NORTH = {
      es: /norte geográfico/, en: /true north/, fr: /nord géographique/,
      de: /geografischen Norden/, ru: /истинного севера/, lt: /tikrosios šiaurės/,
    };
    for (const locale of Object.keys(LOCALES)) {
      const ns = LOCALES[locale].sunrisePage;
      const pattern = TRUE_NORTH[locale as keyof typeof TRUE_NORTH];
      expect(ns.directionBody, `${locale}.directionBody`).toMatch(pattern);
      expect(ns.faqDirectionA, `${locale}.faqDirectionA`).toMatch(pattern);
      expect(ns.directionNote, `${locale}.directionNote`).toMatch(pattern);
    }
  });

  it("states a tolerance on the bearing, which lib/solar.ts puts at 1-2°", () => {
    // `sunDirection`'s docblock: the one-term `declination` is worth "~1-2° of
    // bearing". A whole-degree figure printed with no tolerance claims ±0.5.
    const TOLERANCE = {
      es: /un par de grados/, en: /a couple of degrees/, fr: /un ou deux degrés/,
      de: /ein bis zwei Grad/, ru: /на градус-другой/, lt: /vienu ar dviem laipsniais/,
    };
    for (const locale of Object.keys(LOCALES)) {
      expect(LOCALES[locale].sunrisePage.directionNote, `${locale}.directionNote`)
        .toMatch(TOLERANCE[locale as keyof typeof TOLERANCE]);
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

/**
 * The compass names are a separate namespace because `lib/compass.ts` returns an
 * identifier and never a word: French needs "à l'est" but "au nord-est", so a
 * bare noun cannot be dropped into a sentence behind a fixed preposition. Each
 * locale carries the whole phrase.
 */
describe("compass namespace", () => {
  it.each(Object.keys(LOCALES))("%s names all eight points, bare and in place", (locale) => {
    const { name, in: inPhrase } = LOCALES[locale].compass;
    for (const point of COMPASS_POINTS) {
      expect(typeof name[point], `${locale}.compass.name.${point}`).toBe("string");
      expect(name[point].trim(), `${locale}.compass.name.${point}`).not.toBe("");
      expect(typeof inPhrase[point], `${locale}.compass.in.${point}`).toBe("string");
      expect(inPhrase[point].trim(), `${locale}.compass.in.${point}`).not.toBe("");
    }
  });

  it.each(Object.keys(LOCALES))("%s gives each point a distinct word", (locale) => {
    // A copy-paste that leaves two sectors sharing a name is invisible until a
    // reader is sent the wrong way.
    for (const group of ["name", "in"] as const) {
      const values = COMPASS_POINTS.map((p) => LOCALES[locale].compass[group][p]);
      expect(new Set(values).size, `${locale}.compass.${group}`).toBe(COMPASS_POINTS.length);
    }
  });

  it.each(Object.keys(LOCALES))("%s carries no ICU placeholder in a compass phrase", (locale) => {
    // These are substituted INTO a sentence, so they are plain text by
    // construction; a stray brace would render literally.
    for (const group of ["name", "in"] as const) {
      for (const point of COMPASS_POINTS) {
        expect(LOCALES[locale].compass[group][point], `${locale}.${group}.${point}`)
          .not.toMatch(/[{}]/);
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
      compassIn: (point) => es.compass.in[point],
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
    expect([...supplied.keys()].sort()).toEqual([...SELECTED_KEYS].sort());
  });

  it.each(SELECTED_KEYS)("%s gets every value it asks for", (key) => {
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

  /**
   * The direction strings have two selects the others do not — which side of due
   * east the sun is on, and which way the month walks — and both have a branch
   * ("due", "none") that no shipped city-month currently reaches. A select
   * missing a branch renders nothing at all, silently, so every combination is
   * formatted here rather than only the ones a city happens to produce.
   */
  it.each(Object.keys(LOCALES))("%s formats the direction strings on every branch", (locale) => {
    const base: Record<string, string | number> = {
      city: "Ciudad", month: "mes",
      sunrisePoint: LOCALES[locale].compass.in.ne,
      sunsetPoint: LOCALES[locale].compass.in.nw,
    };
    for (const key of [...DIRECTION_FAQ_KEYS, ...DIRECTION_PAGE_KEYS]) {
      const message = LOCALES[locale].sunrisePage[key];
      for (const offSide of ["north", "south", "due"]) {
        for (const drift of ["north", "south", "none"]) {
          for (const [sunriseBearing, offDegrees, driftDegrees] of [[71, 19, 13], [1, 89, 0], [180, 90, 41]]) {
            const out = new IntlMessageFormat(message, locale).format({
              ...base, offSide, drift,
              sunriseBearing, sunsetBearing: (360 - sunriseBearing) % 360,
              offDegrees, driftDegrees,
            });
            expect(typeof out, `${locale}.${key}`).toBe("string");
            expect(out as string, `${locale}.${key}`).not.toMatch(/[{}]/);
            expect((out as string).trim(), `${locale}.${key}`).not.toBe("");
          }
        }
      }
    }
  });

  /**
   * The house rule, applied end to end: the figures in the sentence a reader
   * sees are the figures `monthDirection` returns, for the city and month the
   * page is about. Nothing here is a literal typed into a message file.
   */
  it("renders Madrid's August answer from the figures lib/sun-copy computes", () => {
    const madrid = BUILTIN_CITIES.find((c) => c.id === "builtin:madrid")!;
    const d = monthDirection(madrid.lat, 7)!;
    const out = new IntlMessageFormat(es.sunrisePage.faqDirectionA, "es").format({
      city: "Madrid", month: "agosto",
      sunrisePoint: es.compass.in[d.sunrisePoint as CompassPoint],
      sunsetPoint: es.compass.in[d.sunsetPoint as CompassPoint],
      sunriseBearing: d.sunriseBearing, sunsetBearing: d.sunsetBearing,
      offDegrees: d.offDegrees, offSide: d.offSide,
      driftDegrees: d.driftDegrees, drift: d.drift,
    }) as string;

    expect(out).toContain("se pone por el oeste");
    expect(out).toContain(`${d.sunsetBearing}°`);
    expect(out).toContain(`${d.offDegrees}° al norte del oeste`);
    expect(out).toContain(`${d.driftDegrees}° hacia el sur`);
  });
});
