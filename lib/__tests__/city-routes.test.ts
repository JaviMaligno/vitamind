import { describe, it, expect } from "vitest";
import {
  CITY_PREFIX, baseSlug, localizedCitySlug, cityIdFromSlug,
  cityPathname, cityUrl, buildCityAlternates, cityStaticParams,
  indexPathname, indexUrl, buildIndexAlternates, indexStaticParams,
} from "@/lib/city-routes";
import { BUILTIN_CITIES } from "@/lib/cities";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

describe("city-routes", () => {
  it("strips the builtin: prefix", () => {
    expect(baseSlug("builtin:nueva-york")).toBe("nueva-york");
  });

  it("localizes the city slug per locale", () => {
    expect(localizedCitySlug("es", "londres")).toBe("londres");
    expect(localizedCitySlug("en", "londres")).toBe("london");
    expect(localizedCitySlug("lt", "londres")).toBe("londonas");
  });

  // ru names are Cyrillic renderings of names that are usually Latin already.
  // Transliterating them back would yield khelsinki / tsyurikh / parizh.
  it("uses the real Latin (en) name for ru slugs, never a back-transliteration", () => {
    expect(localizedCitySlug("ru", "helsinki")).toBe("helsinki");
    expect(localizedCitySlug("ru", "zurich")).toBe("zurich");
    expect(localizedCitySlug("ru", "paris")).toBe("paris");
    expect(localizedCitySlug("ru", "ciudad-de-mexico")).toBe("mexico-city");
    expect(localizedCitySlug("ru", "moscu")).toBe("moscow");
  });

  it("round-trips slug → cityId for every city in every locale", () => {
    for (const locale of routing.locales) {
      for (const city of BUILTIN_CITIES) {
        const base = baseSlug(city.id);
        const slug = localizedCitySlug(locale, base);
        expect(cityIdFromSlug(locale, slug)).toBe(city.id);
      }
    }
  });

  it("produces unique slugs within each locale", () => {
    for (const locale of routing.locales) {
      const slugs = BUILTIN_CITIES.map((c) => localizedCitySlug(locale, baseSlug(c.id)));
      expect(new Set(slugs).size).toBe(BUILTIN_CITIES.length);
    }
  });

  it("builds the localized pathname and absolute url", () => {
    expect(cityPathname("es", "madrid")).toBe("/vitamina-d/madrid");
    expect(cityPathname("en", "londres")).toBe("/vitamin-d/london");
    expect(cityUrl("es", "madrid")).toBe(`${SITE_URL}/vitamina-d/madrid`);
    expect(cityUrl("en", "londres")).toBe(`${SITE_URL}/en/vitamin-d/london`);
  });

  it("builds self-referencing canonical + 6 alternates + x-default (es)", () => {
    const alt = buildCityAlternates("en", "londres");
    expect(alt.canonical).toBe(`${SITE_URL}/en/vitamin-d/london`);
    expect(alt.languages.es).toBe(`${SITE_URL}/vitamina-d/londres`);
    expect(alt.languages.fr).toBe(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(alt.languages.ru).toBe(`${SITE_URL}/ru/vitamin-d/london`);
    expect(alt.languages.lt).toBe(`${SITE_URL}/lt/vitaminas-d/londonas`);
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/vitamina-d/londres`);
  });

  it("keeps every locale's URL for a city distinct", () => {
    for (const city of BUILTIN_CITIES) {
      const base = baseSlug(city.id);
      const urls = routing.locales.map((l) => cityUrl(l, base));
      expect(new Set(urls).size).toBe(routing.locales.length);
    }
  });

  it("emits 438 static params (73 cities × 6 locales)", () => {
    const params = cityStaticParams();
    expect(params).toHaveLength(BUILTIN_CITIES.length * routing.locales.length);
    expect(params).toContainEqual({ locale: "en", cityPrefix: "vitamin-d", city: "london" });
  });

  it("returns null for an unknown slug", () => {
    expect(cityIdFromSlug("en", "atlantis")).toBeNull();
  });

  it("builds the index pathname and url per locale", () => {
    expect(indexPathname("es")).toBe("/vitamina-d");
    expect(indexPathname("en")).toBe("/vitamin-d");
    expect(indexUrl("es")).toBe(`${SITE_URL}/vitamina-d`);
    expect(indexUrl("en")).toBe(`${SITE_URL}/en/vitamin-d`);
    expect(indexUrl("lt")).toBe(`${SITE_URL}/lt/vitaminas-d`);
  });

  it("builds index alternates: 6 languages + x-default (es)", () => {
    const alt = buildIndexAlternates("en");
    expect(alt.canonical).toBe(`${SITE_URL}/en/vitamin-d`);
    expect(alt.languages.es).toBe(`${SITE_URL}/vitamina-d`);
    expect(alt.languages.fr).toBe(`${SITE_URL}/fr/vitamine-d`);
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/vitamina-d`);
  });

  it("emits 6 index static params (one per locale)", () => {
    const params = indexStaticParams();
    expect(params).toHaveLength(routing.locales.length);
    expect(params).toContainEqual({ locale: "en", cityPrefix: "vitamin-d" });
  });
});
