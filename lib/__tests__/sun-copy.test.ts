import { describe, it, expect } from "vitest";
import { BUILTIN_CITIES } from "@/lib/cities";
import { monthData, sunRegime, sunPageCopy } from "@/lib/sun-copy";
import { sunProse } from "@/lib/sun-prose";

/**
 * The month page promises different things in different places: a vitamin D
 * window where one exists, a reason where none does, and a day-by-day caveat
 * where the sun does not rise or set at all. Promising the wrong one is a false
 * claim on an indexed page, so the regime split is tested against the real
 * modules — never against a hand-made fixture.
 *
 * The regime formula is the one `lib/sun-prose.ts` already uses (its lines
 * 74-81). It is duplicated rather than imported because `sunProse` is gated
 * behind the Phase 2 treated/control split and must not run for control pages;
 * the tests below assert the two never disagree.
 */
const city = (slug: string) => {
  const c = BUILTIN_CITIES.find((x) => x.id === `builtin:${slug}`);
  if (!c) throw new Error(`fixture city missing: ${slug}`);
  return c;
};

const copyFor = (slug: string, monthIndex: number) => {
  const c = city(slug);
  const data = monthData(c.lat, c.lon, c.tz, c.timezone, c.elevation ?? 0, monthIndex);
  return { data, copy: sunPageCopy({ cityName: "Ciudad", month: "mes", data }) };
};

const answerKeys = (slug: string, monthIndex: number) =>
  copyFor(slug, monthIndex).copy.faq.map((e) => e.aKey);
const questionKeys = (slug: string, monthIndex: number) =>
  copyFor(slug, monthIndex).copy.faq.map((e) => e.qKey);

describe("sunRegime", () => {
  it("is synthesis for Madrid in August, which has a window", () => {
    const { data } = copyFor("madrid", 7);
    expect(sunRegime(data.days, data.exposure)).toBe("synthesis");
    expect(data.exposure).not.toBeNull();
  });

  it("is none for Madrid in December, where the UV index never reaches 3", () => {
    const { data } = copyFor("madrid", 11);
    expect(sunRegime(data.days, data.exposure)).toBe("none");
    expect(data.exposure).toBeNull();
  });

  it("is polar for Tromso in June even though that month still has a window", () => {
    // 69.65 N: 30 of 30 days are polar day AND computeExposureFromCurve still
    // returns a window. Polar and "no synthesis" are independent facts.
    const { data } = copyFor("tromso", 5);
    expect(sunRegime(data.days, data.exposure)).toBe("polar");
    expect(data.exposure).not.toBeNull();
  });

  it("is polar for Tromso in December, the polar-night half of the same branch", () => {
    const { data } = copyFor("tromso", 11);
    expect(sunRegime(data.days, data.exposure)).toBe("polar");
  });

  it("never disagrees with the regime lib/sun-prose.ts computes", () => {
    for (const [slug, month] of [["madrid", 7], ["madrid", 11], ["tromso", 5], ["tromso", 11], ["reikiavik", 5], ["singapur", 6]] as const) {
      const { data } = copyFor(slug, month);
      expect(`${slug}/${month}: ${sunRegime(data.days, data.exposure)}`).toBe(
        `${slug}/${month}: ${sunProse(city(slug), month).regime}`,
      );
    }
  });
});

describe("sunPageCopy selects the metadata variant for the regime", () => {
  it("promises vitamin D only where there is a window", () => {
    const { copy } = copyFor("madrid", 7);
    expect(copy.regime).toBe("synthesis");
    expect(copy.metaTitleKey).toBe("metaTitle");
    expect(copy.metaDescriptionKey).toBe("metaDescription");
  });

  it("switches to the dusk title and the why-not description with no window", () => {
    const { copy } = copyFor("madrid", 11);
    expect(copy.metaTitleKey).toBe("metaTitleNone");
    expect(copy.metaDescriptionKey).toBe("metaDescriptionNone");
  });

  it("states no clock figure in the polar description", () => {
    const { copy } = copyFor("tromso", 5);
    expect(copy.metaTitleKey).toBe("metaTitlePolar");
    expect(copy.metaDescriptionKey).toBe("metaDescriptionPolar");
    // firstSunrise/firstSunset are null there and would render an em dash.
    expect(copy.metaValues).not.toHaveProperty("firstSunrise");
    expect(copy.metaValues).not.toHaveProperty("firstSunset");
  });

  it("passes the same trend split the intro uses (±3 minutes)", () => {
    expect(copyFor("madrid", 7).copy.metaValues.trend).toBe("shorter"); // -72
    expect(copyFor("buenos-aires", 7).copy.metaValues.trend).toBe("longer"); // +57
    expect(copyFor("singapur", 7).copy.metaValues.trend).toBe("other"); // -2
  });
});

describe("sunPageCopy routes the FAQ questions", () => {
  it("asks the five day/twilight/vitamin D questions where the figures exist", () => {
    expect(questionKeys("madrid", 7)).toEqual([
      "faqDeltaQ", "faqLightQ", "faqDawnQ", "faqDarkQ", "faqVitdQ",
    ]);
    expect(answerKeys("madrid", 7)).toEqual([
      "faqDeltaA", "faqLightA", "faqDawnA", "faqDarkA", "faqVitdASynthesis",
    ]);
  });

  it("answers the vitamin D question with the none variant where there is no window", () => {
    expect(answerKeys("madrid", 11)).toContain("faqVitdANone");
    expect(answerKeys("madrid", 11)).not.toContain("faqVitdASynthesis");
  });

  it("uses the white-night twilight answers where civil dawn and dusk are null", () => {
    // Reykjavik in June: the sun never drops 6 deg below the horizon, so
    // mid.civilDawn and mid.civilDusk are null and the normal answers would
    // print "a las —".
    const { data } = copyFor("reikiavik", 5);
    expect(data.mid.civilDawn).toBeNull();
    expect(data.mid.civilDusk).toBeNull();
    expect(answerKeys("reikiavik", 5)).toContain("faqDawnANoNight");
    expect(answerKeys("reikiavik", 5)).toContain("faqDarkANoNight");
    expect(answerKeys("reikiavik", 5)).not.toContain("faqDawnA");
    expect(answerKeys("reikiavik", 5)).not.toContain("faqDarkA");
  });

  it("replaces every figure question with the polar one on a polar page", () => {
    expect(questionKeys("tromso", 5)).toEqual(["faqPolarQ", "faqVitdQ"]);
    expect(answerKeys("tromso", 5)).toEqual(["faqPolarA", "faqVitdAPolar"]);
  });

  it("makes no yes/no vitamin D claim on a polar page that does have a window", () => {
    const { data, copy } = copyFor("tromso", 5);
    expect(data.exposure).not.toBeNull();
    expect(copy.faq.map((e) => e.aKey)).not.toContain("faqVitdASynthesis");
    expect(copy.faq.map((e) => e.aKey)).not.toContain("faqVitdANone");
  });
});

describe("sunPageCopy states only figures the page already computes", () => {
  it("gives the day-shortening answer the deltaMin figure and the four clock times", () => {
    const { data, copy } = copyFor("madrid", 7);
    const delta = copy.faq.find((e) => e.aKey === "faqDeltaA")!;
    expect(delta.aValues.minutes).toBe(Math.abs(data.deltaMin));
    expect(delta.aValues.lastDay).toBe(data.days.length);
    expect(delta.aValues.firstSunrise).toMatch(/^\d{2}:\d{2}$/);
    expect(delta.aValues.lastSunset).toMatch(/^\d{2}:\d{2}$/);
  });

  it("gives the vitamin D answer the window the page's own card renders", () => {
    const { data, copy } = copyFor("madrid", 7);
    const vitd = copy.faq.find((e) => e.aKey === "faqVitdASynthesis")!;
    expect(vitd.aValues.windowStart).toBe("11:00");
    expect(vitd.aValues.windowEnd).toBe("19:00");
    expect(vitd.aValues.minutes).toBe(Math.round(data.exposure!.minutesNeeded));
  });

  it("never renders an em dash or a NaN inside an answer", () => {
    // The table prints "—" for a missing figure; an answer sentence cannot.
    for (const [slug, month] of [["madrid", 7], ["madrid", 11], ["tromso", 5], ["reikiavik", 5], ["reikiavik", 6], ["anchorage", 0]] as const) {
      for (const entry of copyFor(slug, month).copy.faq) {
        for (const [name, value] of Object.entries(entry.aValues)) {
          expect(`${slug}/${month} ${entry.aKey}.${name}: ${value}`).not.toMatch(/—|NaN/);
        }
      }
    }
  });
});
