import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc }) }));

import {
  resolveDynamicCity, dynamicCityPathname, dynamicCityUrl, buildDynamicCityAlternates,
} from "@/lib/city-dynamic";
import { SITE_URL } from "@/lib/site";

/**
 * The shape of one row of `city_by_slug` / `city_by_geoname_id`, copied from the
 * `RETURNS TABLE` of supabase/migrations/20260826_city_slug_elevation.sql. If
 * that SQL and this fixture ever drift, nothing else in the suite would notice:
 * the RPCs are only exercised for real against a migrated database.
 */
const TOLEDO = {
  geoname_id: 2510409, name: "Toledo", ascii_name: "Toledo", country_code: "ES",
  lat: 39.86, lon: -4.02, population: 83226, timezone: "Europe/Madrid",
  elevation: 529, slug: "toledo-es", display_name: "Toledo",
};

beforeEach(() => { rpc.mockReset(); });

describe("resolveDynamicCity", () => {
  it("returns the city, with its IANA timezone and its real elevation", async () => {
    rpc.mockResolvedValue({ data: [TOLEDO], error: null });
    const got = await resolveDynamicCity("es", "toledo-es");
    expect(got?.city.timezone).toBe("Europe/Madrid");
    expect(got?.city.elevation).toBe(529);
    expect(got?.city.id).toBe("geonames:2510409");
    expect(got?.city.source).toBe("geonames");
  });

  it("resolves a slug through city_by_slug, with the locale it was asked for", async () => {
    rpc.mockResolvedValue({ data: [TOLEDO], error: null });
    await resolveDynamicCity("fr", "toledo-es");
    expect(rpc).toHaveBeenCalledWith("city_by_slug", { p_slug: "toledo-es", p_locale: "fr" });
  });

  it("never queries the database for a slug the prefilter rejects", async () => {
    expect(await resolveDynamicCity("es", "aaaa")).toBeNull();
    expect(await resolveDynamicCity("es", "../../etc/passwd")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null on a miss, and does not throw", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await resolveDynamicCity("es", "nowhere-zz")).toBeNull();
  });

  it("returns null when Supabase errors, rather than propagating", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await resolveDynamicCity("es", "toledo-es")).toBeNull();
  });

  it("resolves the id alias through the id RPC and reports the canonical slug", async () => {
    rpc.mockResolvedValue({ data: [TOLEDO], error: null });
    const got = await resolveDynamicCity("es", "id-2510409");
    expect(rpc).toHaveBeenCalledWith("city_by_geoname_id",
      { p_geoname_id: 2510409, p_locale: "es" });
    expect(got?.canonicalSlug).toBe("toledo-es");
  });

  /**
   * `cities.slug` is nullable, and `city_by_geoname_id` does NOT filter on it: a
   * row that exists but has not been seeded with a slug comes back with
   * `slug: null`. Serving it would publish a page whose canonical URL ends in
   * `/null` and whose alias 301 points nowhere. This is the state of EVERY row
   * between applying the migration and running the re-seed.
   */
  it("refuses a row that has no slug yet, instead of emitting a null URL", async () => {
    rpc.mockResolvedValue({ data: [{ ...TOLEDO, slug: null }], error: null });
    expect(await resolveDynamicCity("es", "id-2510409")).toBeNull();
  });

  /**
   * GeoNames has no `dem` value for 437 of 235,503 rows (0.2%), which the seed
   * stores as NULL rather than as a claim about sea level. `City.elevation` is
   * optional and its consumers (lib/city-content.ts, lib/uv-model.ts) default to
   * 0 m, so undefined is the fallback — the same treatment every non-curated
   * city gets today, and it must NOT arrive as a literal null.
   */
  it("maps a missing elevation to undefined, never to null or 0", async () => {
    rpc.mockResolvedValue({ data: [{ ...TOLEDO, elevation: null }], error: null });
    const got = await resolveDynamicCity("es", "toledo-es");
    expect(got?.city.elevation).toBeUndefined();
  });

  /**
   * Q-B(a): where city_names has no entry the GeoNames endonym is served and the
   * page says so. Measured 2026-08-26: coverage is 17.8% in ru and 2.3% in lt.
   */
  it("falls back to the GeoNames name and flags it when there is no localized name", async () => {
    rpc.mockResolvedValue({ data: [{ ...TOLEDO, display_name: "Toledo" }], error: null });
    const got = await resolveDynamicCity("lt", "toledo-es");
    expect(got?.city.name).toBe("Toledo");
    expect(got?.nameIsLocalized).toBe(false);
  });
});

describe("URL builders", () => {
  it("uses the locale prefix and never localizes the slug", () => {
    expect(dynamicCityPathname("es", "toledo-es")).toBe("/vitamina-d/toledo-es");
    expect(dynamicCityPathname("en", "toledo-es")).toBe("/vitamin-d/toledo-es");
    expect(dynamicCityPathname("lt", "toledo-es")).toBe("/vitaminas-d/toledo-es");
  });

  it("builds absolute URLs with es prefix-free", () => {
    expect(dynamicCityUrl("es", "toledo-es")).toBe(`${SITE_URL}/vitamina-d/toledo-es`);
    expect(dynamicCityUrl("fr", "toledo-es")).toBe(`${SITE_URL}/fr/vitamine-d/toledo-es`);
  });

  it("gives six hreflang alternates plus x-default at es, like buildCityAlternates", () => {
    const alt = buildDynamicCityAlternates("en", "toledo-es");
    expect(alt.canonical).toBe(`${SITE_URL}/en/vitamin-d/toledo-es`);
    expect(Object.keys(alt.languages)).toHaveLength(7);
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/vitamina-d/toledo-es`);
  });
});
