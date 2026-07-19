import { describe, it, expect } from "vitest";
import {
  SUN_PREFIX, MONTH_SLUGS, SUNRISE_CITIES, monthIndexFromSlug, sunPathname,
  sunStaticParams, resolveSunPage, buildSunAlternates,
} from "../sun-routes";
import { CITY_SLUGS } from "../city-slugs";
import { routing } from "@/i18n/routing";

describe("sun routes", () => {
  it("every starter city exists in the slug DB", () => {
    for (const base of SUNRISE_CITIES) {
      expect(CITY_SLUGS[base], base).toBeDefined();
    }
  });

  it("every locale has a prefix and 12 month slugs, all ASCII", () => {
    for (const locale of routing.locales) {
      expect(SUN_PREFIX[locale]).toMatch(/^[a-z-]+$/);
      expect(MONTH_SLUGS[locale]).toHaveLength(12);
      for (const slug of MONTH_SLUGS[locale]) expect(slug).toMatch(/^[a-z]+$/);
    }
  });

  it("builds localized paths and resolves them back", () => {
    expect(sunPathname("es", "madrid", 6)).toBe("/amanecer/madrid/julio");
    expect(sunPathname("en", "londres", 0)).toBe("/sunrise/london/january");

    const es = resolveSunPage("es", "amanecer", "madrid", "julio");
    expect(es).not.toBeNull();
    expect(es!.base).toBe("madrid");
    expect(es!.monthIndex).toBe(6);

    const en = resolveSunPage("en", "sunrise", "london", "january");
    expect(en!.base).toBe("londres");
  });

  it("rejects wrong prefixes, unknown months and out-of-batch cities", () => {
    expect(resolveSunPage("es", "vitamina-d", "madrid", "julio")).toBeNull();
    expect(resolveSunPage("es", "amanecer", "madrid", "noesmes")).toBeNull();
    expect(resolveSunPage("es", "amanecer", "tromso", "julio")).toBeNull();
    expect(monthIndexFromSlug("en", "julio")).toBeNull();
  });

  it("generates locale×city×month static params", () => {
    const params = sunStaticParams();
    expect(params).toHaveLength(routing.locales.length * SUNRISE_CITIES.length * 12);
    const es = params.find((p) => p.locale === "es" && p.city === "madrid" && p.month === "julio");
    expect(es?.cityPrefix).toBe("amanecer");
  });

  it("alternates cover all six locales plus x-default", () => {
    const alt = buildSunAlternates("en", "madrid", 6);
    expect(Object.keys(alt.languages)).toHaveLength(routing.locales.length + 1);
    expect(alt.languages["x-default"]).toContain("/amanecer/madrid/julio");
    expect(alt.canonical).toContain("/en/sunrise/madrid/july");
  });
});
