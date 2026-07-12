import { describe, it, expect } from "vitest";
import { CITY_SLUGS } from "@/lib/city-slugs";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug, localizedCitySlug } from "@/lib/city-routes";
import { routing } from "@/i18n/routing";

/**
 * CITY_SLUGS is a generated data literal (so the client can use it without
 * bundling the messages). This test is what keeps it honest: it must equal what
 * lib/city-routes computes for every city and locale. If a city name changes and
 * the map is not regenerated, this fails.
 */
describe("CITY_SLUGS matches city-routes", () => {
  it("covers every builtin city", () => {
    expect(Object.keys(CITY_SLUGS).sort()).toEqual(
      BUILTIN_CITIES.map((c) => baseSlug(c.id)).sort(),
    );
  });

  it("agrees with localizedCitySlug for every city × locale", () => {
    for (const city of BUILTIN_CITIES) {
      const base = baseSlug(city.id);
      for (const locale of routing.locales) {
        expect(CITY_SLUGS[base]?.[locale]).toBe(localizedCitySlug(locale, base));
      }
    }
  });

  it("uses the real Latin name for ru, not a back-transliteration", () => {
    expect(CITY_SLUGS.helsinki.ru).toBe("helsinki");
    expect(CITY_SLUGS.moscu.ru).toBe("moscow");
    expect(CITY_SLUGS["nueva-york"].ru).toBe("new-york");
  });
});
