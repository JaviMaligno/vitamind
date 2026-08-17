import { describe, it, expect } from "vitest";
import {
  SUN_PREFIX, SUNRISE_CITIES,
  sunCityPathname, sunCityUrl, buildSunCityAlternates, sunCityStaticParams, resolveSunCityPage,
} from "../sun-routes";
import { zonedDate } from "../timezone";
import { cityToday, sunTodayData, sunTodayCopy } from "../sun-today";
import { CITY_PREFIX, cityStaticParams } from "../city-routes";
import { BUILTIN_CITIES } from "../cities";
import { cityYearProfile, contiguousMonthRange } from "../city-content";
import { doyFromMonthDay } from "../solar";
import { routing } from "@/i18n/routing";
import type { City } from "../types";

const city = (slug: string): City => BUILTIN_CITIES.find((c) => c.id === `builtin:${slug}`)!;

/**
 * The city hub at the sunrise prefix without a month (`/amanecer/madrid`).
 * It shares the [cityPrefix]/[city] segment with the vitamin D city pages, so
 * the resolver has to reject the OTHER family's prefix rather than accept
 * anything that parses — getting that wrong 404s 438 live pages.
 */
describe("sun city routes", () => {
  it("builds the localized path and resolves it back", () => {
    expect(sunCityPathname("es", "madrid")).toBe("/amanecer/madrid");
    expect(sunCityPathname("en", "londres")).toBe("/sunrise/london");
    expect(sunCityPathname("de", "viena")).toBe("/sonnenaufgang/wien");

    expect(resolveSunCityPage("es", "amanecer", "madrid")!.base).toBe("madrid");
    expect(resolveSunCityPage("en", "sunrise", "london")!.base).toBe("londres");
  });

  it("rejects the city-page prefix, unknown slugs and out-of-batch cities", () => {
    // /vitamina-d/madrid is a live page of the OTHER family — it must not resolve here.
    expect(resolveSunCityPage("es", "vitamina-d", "madrid")).toBeNull();
    expect(resolveSunCityPage("es", "amanecer", "no-existe")).toBeNull();
    expect(resolveSunCityPage("es", "amanecer", "tromso")).toBeNull();
    // A month slug is not a city slug: /amanecer/julio must not become a hub.
    expect(resolveSunCityPage("es", "amanecer", "julio")).toBeNull();
  });

  it("generates one static param per locale × sunrise city", () => {
    const params = sunCityStaticParams();
    expect(params).toHaveLength(routing.locales.length * SUNRISE_CITIES.length);
    for (const p of params) expect(p.cityPrefix).toBe(SUN_PREFIX[p.locale]);
    expect(params.find((p) => p.locale === "es" && p.city === "madrid")).toBeDefined();
  });

  /**
   * The 438 vitamin D city pages are live. If the two prefix maps ever agreed
   * on a locale, or if a hub resolver accepted a city-page param, that whole
   * family would start rendering the wrong page — so both directions are
   * checked exhaustively rather than by sampling.
   */
  it("never shares a prefix with the vitamin D city pages", () => {
    for (const locale of routing.locales) {
      expect(SUN_PREFIX[locale], locale).not.toBe(CITY_PREFIX[locale]);
    }
  });

  it("resolves every param it generates, and none of the city pages'", () => {
    for (const p of sunCityStaticParams()) {
      expect(resolveSunCityPage(p.locale, p.cityPrefix, p.city), `${p.locale} ${p.city}`).not.toBeNull();
    }
    for (const p of cityStaticParams()) {
      expect(resolveSunCityPage(p.locale, p.cityPrefix, p.city), `${p.locale} ${p.city}`).toBeNull();
    }
  });

  it("alternates cover all six locales plus x-default", () => {
    const alt = buildSunCityAlternates("en", "madrid");
    expect(Object.keys(alt.languages)).toHaveLength(routing.locales.length + 1);
    expect(alt.canonical).toBe(sunCityUrl("en", "madrid"));
    expect(alt.canonical).toContain("/en/sunrise/madrid");
    expect(alt.languages["x-default"]).toContain("/amanecer/madrid");
    expect(alt.languages.es).not.toContain("/es/");
  });
});

/**
 * "Today" is a different calendar date in Tokyo and in Los Angeles at the same
 * instant, and each of the 40 cities has its own zone. The page's date comes
 * from the CITY's zone, never from the machine that renders it.
 */
describe("today in the city's own zone", () => {
  // 2026-08-16T02:00Z: still the 15th in Los Angeles, already the 16th in Tokyo.
  const instant = new Date("2026-08-16T02:00:00Z");

  it("reads the calendar date in the given zone, not the host's", () => {
    expect(zonedDate(instant, "Asia/Tokyo")).toEqual({ year: 2026, monthIndex: 7, day: 16 });
    expect(zonedDate(instant, "America/Los_Angeles")).toEqual({ year: 2026, monthIndex: 7, day: 15 });
    expect(zonedDate(instant, "UTC")).toEqual({ year: 2026, monthIndex: 7, day: 16 });
  });

  it("falls back to a fixed offset when the record carries no IANA name", () => {
    expect(zonedDate(instant, undefined, -5)).toEqual({ year: 2026, monthIndex: 7, day: 15 });
  });

  it("gives each city its own day number", () => {
    const tokyo = cityToday(city("tokio"), instant);
    const la = cityToday(city("los-angeles"), instant);
    expect(tokyo.day).toBe(16);
    expect(la.day).toBe(15);
    expect(tokyo.doy).toBe(doyFromMonthDay(7, 16));
    expect(la.doy).toBe(doyFromMonthDay(7, 15));
  });
});

describe("today's synthesis window", () => {
  const at = (slug: string, monthIndex: number, day: number) => {
    const c = city(slug);
    return sunTodayData(c, { year: 2026, monthIndex, day, doy: doyFromMonthDay(monthIndex, day) });
  };

  it("Madrid in August has a window, and it is the day's own", () => {
    const d = at("madrid", 7, 16);
    expect(d.regime).toBe("synthesis");
    expect(d.exposure).not.toBeNull();
    expect(d.exposure!.windowEnd).toBeGreaterThan(d.exposure!.windowStart);
    expect(d.sun.sunrise).not.toBeNull();
  });

  /**
   * Oslo in December has none, and the reason is that clear-sky UVI never
   * reaches MIN_UVI (3) — not that the sun is low, which is the claim that
   * shipped wrong once already. Rome at a lower peak elevation still has one.
   */
  it("Oslo in December has none", () => {
    expect(at("oslo", 11, 16).regime).toBe("none");
    expect(at("oslo", 11, 16).exposure).toBeNull();
  });

  /**
   * The freshness argument rests on this: `computeExposureFromCurve` reports the
   * window in WHOLE local hours, so a server-rendered window cannot drift by
   * minutes as the days pass — it either holds or moves by exactly one hour.
   */
  it("reports the window in whole hours", () => {
    const d = at("madrid", 7, 16).exposure!;
    expect(Number.isInteger(d.windowStart)).toBe(true);
    expect(Number.isInteger(d.windowEnd)).toBe(true);
  });

  it("moves by at most one hour from one day to the next, all year", () => {
    for (const slug of ["madrid", "oslo", "sidney", "singapur"]) {
      for (let m = 0; m < 12; m++) {
        const a = at(slug, m, 10).exposure;
        const b = at(slug, m, 11).exposure;
        if (!a || !b) continue;
        expect(Math.abs(a.windowStart - b.windowStart), `${slug} ${m}`).toBeLessThanOrEqual(1);
        expect(Math.abs(a.windowEnd - b.windowEnd), `${slug} ${m}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("calls a polar day polar rather than inventing a sunrise", () => {
    const svalbard: City = {
      id: "test:svalbard", name: "Svalbard", lat: 78.2, lon: 15.6, tz: 1,
      timezone: "Europe/Oslo", source: "builtin",
    };
    const d = sunTodayData(svalbard, { year: 2026, monthIndex: 5, day: 21, doy: doyFromMonthDay(5, 21) });
    expect(d.regime).toBe("polar");
    expect(d.sun.sunrise).toBeNull();
  });
});

describe("what the page says", () => {
  const copyFor = (slug: string, monthIndex: number, day: number) => {
    const c = city(slug);
    const today = { year: 2026, monthIndex, day, doy: doyFromMonthDay(monthIndex, day) };
    const profile = cityYearProfile(c.lat, c.lon, c.elevation ?? 0);
    return sunTodayCopy({
      locale: "es",
      cityName: "Ciudad",
      data: sunTodayData(c, today),
      profile,
      band: contiguousMonthRange(profile.possibleMonths),
    });
  };

  /** Values that are true of one day and no other. */
  const DAY_ARGS = ["date", "year", "windowStart", "windowEnd", "minutes", "sunrise", "sunset", "dayLength"];

  /**
   * The freshness contract where it actually bites.
   *
   * The page's metadata is quoted by a search engine and ingested by an AI
   * Overview, and no browser ever corrects it. ISR bounds nothing: the HTML is
   * as old as the last request that triggered a regeneration. Madrid in August
   * has an eight-hour window and Oslo in December has none, so a metadata
   * string that branched on regime — or carried the window figures — could
   * assert the exact opposite of the truth for months. It carries neither.
   */
  it("puts no day-specific figure in the metadata", () => {
    for (const [slug, m] of [["madrid", 7], ["oslo", 11]] as const) {
      expect(Object.keys(copyFor(slug, m, 16).metaValues), `${slug} ${m}`).toEqual(["city"]);
    }
  });

  /**
   * Same argument for the FAQPage markup: it is server-only, so it carries only
   * the answer that is a property of the PLACE rather than of today.
   */
  it("keeps the day-dependent answers out of the stale-proof FAQ entry", () => {
    for (const [slug, m] of [["madrid", 7], ["oslo", 11], ["singapur", 0]] as const) {
      const { yearFaq } = copyFor(slug, m, 16);
      expect(yearFaq.aKey, `${slug} ${m}`).toMatch(/^faqYearA/);
      for (const v of [yearFaq.qValues, yearFaq.aValues]) {
        expect(Object.keys(v).filter((k) => DAY_ARGS.includes(k)), `${slug} ${m}`).toEqual([]);
      }
    }
  });

  it("answers the window and then the sun times in the day-dependent list", () => {
    const copy = copyFor("madrid", 7, 16);
    expect(copy.dayFaq.map((f) => f.qKey)).toEqual(["faqWindowQ", "faqSunQ"]);
    expect(copy.dayFaq[0].aKey).toBe("faqWindowASynthesis");
    expect(copy.dayFaq[0].aValues.windowStart).toMatch(/^\d\d:\d\d$/);
    expect(copyFor("oslo", 11, 16).dayFaq[0].aKey).toBe("faqWindowANone");
  });

  it("states the months of the year from the profile, not from today", () => {
    // Madrid has a real winter gap; Singapore does not.
    expect(copyFor("madrid", 7, 16).yearFaq.aKey).toBe("faqYearARange");
    expect(copyFor("singapur", 7, 16).yearFaq.aKey).toBe("faqYearAAll");
  });
});
