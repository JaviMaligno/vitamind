import { describe, it, expect } from "vitest";

import { routing } from "@/i18n/routing";
import { CITY_PREFIX } from "@/lib/city-prefix";
import { SUN_PREFIX } from "@/lib/sun-routes";
import {
  SUNTIME_PREFIX,
  BAND_SLUGS,
  BANDS,
  BAND_TYPES,
  bandFromSlug,
  localeForSuntimePrefix,
  resolveSuntimePage,
  resolveSuntimeBandPage,
  suntimePathname,
  suntimeBandPathname,
  allSuntimePathnames,
} from "@/lib/suntime-routes";

/**
 * The invariants the 24 URLs rest on. Nothing here exercises a page — it pins
 * the shape of the constants, because every downstream guarantee (the
 * middleware test, the folder-name test, the sitemap) is stated in terms of
 * them.
 */
describe("suntime routes — the slug table", () => {
  it("covers all six locales, mother and bands", () => {
    for (const locale of routing.locales) {
      expect(SUNTIME_PREFIX[locale], `mother prefix for ${locale}`).toBeTruthy();
      for (const band of BANDS) {
        expect(BAND_SLUGS[locale]?.[band], `${band} slug for ${locale}`).toBeTruthy();
      }
    }
    expect(Object.keys(SUNTIME_PREFIX).sort()).toEqual([...routing.locales].sort());
    expect(Object.keys(BAND_SLUGS).sort()).toEqual([...routing.locales].sort());
  });

  it("is ASCII, lowercase and hyphenated throughout", () => {
    // The URLs are typed and shared by hand; a percent-encoded ё or ū in a slug
    // is a URL nobody can read back to you over the phone. Same rule the city
    // and sunrise prefixes already follow.
    const ok = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const locale of routing.locales) {
      expect(SUNTIME_PREFIX[locale]).toMatch(ok);
      for (const band of BANDS) expect(BAND_SLUGS[locale][band]).toMatch(ok);
    }
  });

  it("carries no Fitzpatrick numeral in any slug", () => {
    // Spec §3: by description, never by number. The numeral is a gloss inside
    // the page; a slug that names it asks the reader for a fact they do not
    // reliably know about themselves.
    for (const locale of routing.locales) {
      for (const band of BANDS) {
        expect(BAND_SLUGS[locale][band]).not.toMatch(/\d|\b(i{1,3}v?|vi?)\b/);
      }
    }
  });

  it("gives every locale a distinct mother prefix", () => {
    // Stricter than the city pages need (de and ru share `vitamin-d` with en),
    // and load-bearing here: the route folders are static, so a shared prefix
    // would make one locale's folder shadow the other's.
    const prefixes = routing.locales.map((l) => SUNTIME_PREFIX[l]);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("keeps the mother prefix disjoint from the city and sunrise prefixes", () => {
    // The whole reason these pages do not hang off `vitamina-d`: the on-demand
    // rewrite eats any two-segment path under a CITY_PREFIX. Colliding with a
    // SUN_PREFIX would instead put two static folders at the same path.
    const taken = new Set([
      ...Object.values(CITY_PREFIX),
      ...Object.values(SUN_PREFIX),
    ]);
    for (const locale of routing.locales) {
      expect(taken.has(SUNTIME_PREFIX[locale]), `${locale} collides`).toBe(false);
    }
  });

  it("keeps the three band slugs distinct within each locale", () => {
    for (const locale of routing.locales) {
      const slugs = BANDS.map((b) => BAND_SLUGS[locale][b]);
      expect(new Set(slugs).size, `${locale} repeats a band slug`).toBe(3);
    }
  });

  it("maps the three bands onto the six Fitzpatrick types exactly once each", () => {
    const covered = BANDS.flatMap((b) => {
      const [from, to] = BAND_TYPES[b];
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });
    expect(covered.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("suntime routes — resolution", () => {
  it("accepts a locale's own prefix and rejects every other locale's", () => {
    // A static folder is matched for EVERY locale, so `/en/cuanto-sol-vitamina-d`
    // arrives at the Spanish folder with locale "en". Returning false is what
    // makes that a 404 rather than a duplicate with a foreign canonical.
    for (const locale of routing.locales) {
      expect(resolveSuntimePage(locale, SUNTIME_PREFIX[locale])).toBe(true);
      for (const other of routing.locales) {
        if (other === locale) continue;
        expect(
          resolveSuntimePage(locale, SUNTIME_PREFIX[other]),
          `${locale} accepted ${other}'s prefix`,
        ).toBe(false);
      }
    }
  });

  it("resolves each band slug in its own locale only", () => {
    for (const locale of routing.locales) {
      for (const band of BANDS) {
        const slug = BAND_SLUGS[locale][band];
        expect(resolveSuntimeBandPage(locale, SUNTIME_PREFIX[locale], slug)).toBe(band);
        // Right slug, wrong locale's prefix → null, same reason as above.
        for (const other of routing.locales) {
          if (other === locale) continue;
          expect(
            resolveSuntimeBandPage(locale, SUNTIME_PREFIX[other], slug),
          ).toBeNull();
        }
      }
    }
  });

  it("returns null for an unknown band slug", () => {
    expect(resolveSuntimeBandPage("es", SUNTIME_PREFIX.es, "piel-verde")).toBeNull();
    expect(bandFromSlug("es", "fair-skin")).toBeNull(); // the English slug, in Spanish
    expect(bandFromSlug("xx", "piel-clara")).toBeNull(); // unknown locale
  });

  it("turns a folder name back into its locale, and nothing else", () => {
    for (const locale of routing.locales) {
      expect(localeForSuntimePrefix(SUNTIME_PREFIX[locale])).toBe(locale);
    }
    expect(localeForSuntimePrefix("vitamina-d")).toBeNull();
    expect(localeForSuntimePrefix("amanecer")).toBeNull();
  });
});

describe("suntime routes — the 24 paths", () => {
  it("lists four pages per locale, all distinct", () => {
    const all = allSuntimePathnames();
    expect(all).toHaveLength(routing.locales.length * 4);
    expect(new Set(all.map((p) => p.pathname)).size).toBe(all.length);
  });

  it("nests each band under its own locale's mother", () => {
    for (const locale of routing.locales) {
      for (const band of BANDS) {
        expect(suntimeBandPathname(locale, band).startsWith(`${suntimePathname(locale)}/`)).toBe(
          true,
        );
      }
    }
  });

  it("gives the mother one segment and each band two", () => {
    // The segment count is not cosmetic: `onDemandCityRewrite` only looks at
    // two-segment paths, so the band pages are the ones at risk and the count
    // is what the middleware test keys on.
    for (const { pathname } of allSuntimePathnames()) {
      const segments = pathname.split("/").filter(Boolean);
      expect(segments.length === 1 || segments.length === 2).toBe(true);
    }
  });
});
