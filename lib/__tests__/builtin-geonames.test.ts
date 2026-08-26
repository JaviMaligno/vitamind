import { describe, it, expect } from "vitest";
import { BUILTIN_GEONAME_ID } from "@/lib/builtin-geonames";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug } from "@/lib/city-routes";
import { isDynamicCitySlug } from "@/lib/city-dynamic-slug";

describe("BUILTIN_GEONAME_ID", () => {
  /**
   * The assert that carries the weight. A curated city MISSING from this map is
   * the failure that matters: its qualified form (`/vitamina-d/edinburgh-gb`)
   * would resolve through the dynamic branch and publish a second page for a
   * city that already has one, competing with it for the same query. An extra
   * key is the milder bug — a 301 to a curated URL that does not exist.
   */
  it("covers every curated city, with no extras", () => {
    const bases = BUILTIN_CITIES.map((c) => baseSlug(c.id)).sort();
    expect(Object.keys(BUILTIN_GEONAME_ID).sort()).toEqual(bases);
  });

  it("has no duplicate ids — two curated cities cannot be the same place", () => {
    const ids = Object.values(BUILTIN_GEONAME_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("holds plausible GeoNames ids", () => {
    for (const [base, id] of Object.entries(BUILTIN_GEONAME_ID)) {
      expect(Number.isInteger(id), base).toBe(true);
      expect(id, base).toBeGreaterThan(0);
    }
  });

  /**
   * The keys are curated bases, so by construction none of them may look like a
   * dynamic slug — otherwise the two namespaces would overlap and the 301 would
   * point back at the dynamic branch it came from. Same disjointness D-12
   * asserts on CITY_SLUGS, checked here on the other side of the map.
   */
  it("keys are curated bases, never dynamic slugs", () => {
    for (const base of Object.keys(BUILTIN_GEONAME_ID)) {
      expect(isDynamicCitySlug(base), base).toBe(false);
    }
  });

  /**
   * The three entries that are NOT a name match, pinned with their reason.
   * `scripts/dump-builtin-geonames.ts` resolves 70 of the 73 by matching a
   * GeoNames name against the city's six localized slugs inside 25 km, with no
   * ambiguity anywhere — no city had a second candidate in range. These three
   * needed a human decision, listed in that script's MANUAL table, and a human
   * decision is exactly what a regeneration must not quietly revise:
   *
   *   nueva-york  GeoNames keeps the "City" suffix ("New York City") that none
   *               of the six locales uses. The boroughs are separate rows and
   *               are deliberately not it.
   *   las-palmas  GeoNames spells out "Las Palmas de Gran Canaria"; every
   *               locale of the curated page uses the short form.
   *   tenerife    Named after the island, but sited at 28.47/-16.25 — which is
   *               Santa Cruz de Tenerife, 0.5 km from this row. cities500 has
   *               no row for an island, and leaving it unmapped would let Santa
   *               Cruz open a second page on the curated page's own coordinates.
   */
  it("pins the three cities that needed a human decision", () => {
    expect(BUILTIN_GEONAME_ID["nueva-york"]).toBe(5128581);
    expect(BUILTIN_GEONAME_ID["las-palmas"]).toBe(2515270);
    expect(BUILTIN_GEONAME_ID["tenerife"]).toBe(2511174);
  });

  /** A spot check on the ordinary path, so a wholesale regeneration is visible. */
  it("holds the ids of cities that matched by name", () => {
    expect(BUILTIN_GEONAME_ID["madrid"]).toBe(3117735);
    expect(BUILTIN_GEONAME_ID["edimburgo"]).toBe(2650225);
    expect(BUILTIN_GEONAME_ID["tokio"]).toBe(1850147);
    expect(BUILTIN_GEONAME_ID["bogota"]).toBe(3688689);
  });
});
