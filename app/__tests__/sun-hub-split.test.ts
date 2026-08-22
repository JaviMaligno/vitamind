import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { routing } from "@/i18n/routing";
import { SUN_PREFIX, localeForSunPrefix, sunCityStaticParams } from "@/lib/sun-routes";

/**
 * THE TRIPWIRE FOR THE HUB/CITY ROUTE SPLIT.
 *
 * The 240 today hubs and the 438 vitamin D city pages used to be one route file,
 * which forced one `revalidate` on both families even though only the hubs need
 * an interval. The hubs now have six static route folders — one per value of
 * SUN_PREFIX — which outrank the dynamic `[cityPrefix]` sibling, so the city
 * pages can be `revalidate = false`.
 *
 * The cost of that design is a duplication the type system cannot see: six
 * DIRECTORY NAMES on disk that have to keep agreeing with six string values in
 * lib/sun-routes.ts. Rename a prefix, add a seventh locale, or delete a folder
 * and the affected hubs are still in the sitemap, still linked from every month
 * page, and routed by nothing — 40 live URLs per locale turning into 404s, which
 * is exactly the class of failure this repo has shipped before and found weeks
 * later. This file is the reason that cannot happen quietly.
 */

const APP = join(process.cwd(), "app/[locale]");
const CITY_PAGE = join(APP, "[cityPrefix]/[city]/page.tsx");

/** Every directory under app/[locale] that owns a `[city]/page.tsx`. */
function cityOwningDirs(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(APP, e.name, "[city]/page.tsx")))
    .map((e) => e.name)
    .sort();
}

describe("sunrise hub route folders", () => {
  it("gives every locale a prefix, and every prefix a distinct value", () => {
    // A locale with no SUN_PREFIX entry cannot have a folder, so this is the
    // first thing that breaks when a seventh locale is added.
    for (const locale of routing.locales) {
      expect(SUN_PREFIX[locale], `no SUN_PREFIX for "${locale}"`).toBeTruthy();
    }
    // Distinctness is what makes `localeForSunPrefix` (and therefore a folder's
    // ability to know its own locale) well defined at all.
    const values = routing.locales.map((l) => SUN_PREFIX[l]);
    expect(new Set(values).size).toBe(values.length);
    for (const locale of routing.locales) {
      expect(localeForSunPrefix(SUN_PREFIX[locale])).toBe(locale);
    }
  });

  it("has exactly one route folder per prefix, and no folder that is not one", () => {
    const expected = [...routing.locales.map((l) => SUN_PREFIX[l]), "[cityPrefix]"].sort();
    // Set equality, not containment, in both directions: a MISSING folder 404s a
    // locale's hubs, and a LEFTOVER folder (a prefix renamed without deleting
    // the old directory) serves a hub at a URL nothing links to or canonicalises
    // — duplicate content pointing away from itself.
    expect(cityOwningDirs()).toEqual(expected);
  });

  it("pins each folder's PREFIX literal to its own directory name", () => {
    for (const locale of routing.locales) {
      const prefix = SUN_PREFIX[locale];
      const source = readFileSync(join(APP, prefix, "[city]/page.tsx"), "utf8");
      // The literal is what `resolveSunCityPage` is called with. If it drifts
      // from the directory the folder is matched for, every URL it owns 404s
      // while the build still succeeds — the folder prerenders the OTHER
      // locale's cities under this locale's prefix, or nothing at all.
      expect(source, `${prefix}: PREFIX does not match its directory`).toContain(
        `const PREFIX = "${prefix}";`,
      );
      // Delegation, not a copy: six divergent renderers is the other way this
      // design rots.
      expect(source).toMatch(/from "\.\.\/\.\.\/_sun-hub\/hub-route"/);
    }
  });

  it("keeps the daily interval on every hub folder", () => {
    for (const locale of routing.locales) {
      const source = readFileSync(join(APP, SUN_PREFIX[locale], "[city]/page.tsx"), "utf8");
      // Segment config is per file, so "the hubs revalidate daily" is a claim
      // about six files. Five out of six is a locale frozen at build time,
      // asserting a vitamin D window that a season has since moved.
      expect(source, `${SUN_PREFIX[locale]} lost its interval`).toMatch(
        /export const revalidate = 86400/,
      );
    }
  });

  it("prerenders, across the folders ON DISK, exactly the 240 hubs the sitemap lists", async () => {
    /**
     * One side of this comparison MUST come from the filesystem.
     *
     * The first version of this assertion reassembled `sunCityStaticParams()`
     * by filtering it on `SUN_PREFIX` and compared the result to itself — both
     * sides derived from the same table in memory, so it was a tautology. It
     * passed with a hub folder renamed away, which is precisely the outage it
     * was written to catch and the one thing it claimed to prove.
     *
     * So the folder set is read from disk and each folder is asked for its own
     * params through the real route helper. A renamed folder makes
     * `sunHubStaticParams` throw on the unknown prefix; a deleted one leaves
     * its 40 URLs missing from the union. Either way this fails.
     */
    const { sunHubStaticParams } = await import("../[locale]/_sun-hub/hub-route");

    const hubDirs = cityOwningDirs().filter((d) => d !== "[cityPrefix]");
    const fromDisk = hubDirs
      .flatMap((dir) => {
        const locale = localeForSunPrefix(dir);
        return sunHubStaticParams(dir).map((p) => `${locale}/${p.city}`);
      })
      .sort();

    const expected = sunCityStaticParams()
      .map((p) => `${p.locale}/${p.city}`)
      .sort();

    expect(fromDisk).toEqual(expected);
    expect(new Set(fromDisk).size).toBe(expected.length);
  });

  it("leaves no hub dispatch behind in the shared city route", () => {
    const source = readFileSync(CITY_PAGE, "utf8");
    // Both route files prerendering the same URL is a build conflict, and a
    // second live copy of the hub — on a file whose revalidate is now false —
    // would be a page frozen on the day it was built.
    expect(source).not.toMatch(/sunCityStaticParams/);
    expect(source).not.toMatch(/resolveSunCityPage/);
    expect(source).not.toMatch(/SunTodayPage/);
  });
});

describe("vitamin D city pages are static", () => {
  const source = readFileSync(CITY_PAGE, "utf8");

  /**
   * Mirrors the assertion on the month pages (app/__tests__/prose-gating.test.ts):
   * pin the static class AND the property that justifies it, so the test fails
   * for the right reason. A page frozen forever that reads a clock is worse than
   * the stale-for-a-day it replaced.
   */
  it("is frozen at build time, because nothing on its render path reads a clock", () => {
    expect(source).toMatch(/export const revalidate = false/);

    // `todayDoy()` is the one export of lib/solar.ts whose result depends on
    // when it is called; everything else there derives from its arguments.
    expect(source).not.toMatch(/todayDoy/);

    // A bare `new Date()` or `Date.now()` is a clock read. `new Date(x)` and
    // `new Date(Date.UTC(...))` are deterministic given their arguments, which
    // is how every date on this path is built.
    const renderPath = [
      "app/[locale]/[cityPrefix]/[city]/page.tsx",
      "lib/city-content.ts",
      "lib/city-copy.ts",
      "lib/city-nearby.ts",
      "lib/sun-times.ts",
    ];
    for (const file of renderPath) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text, `${file} reads a clock`).not.toMatch(/new Date\(\s*\)/);
      expect(text, `${file} reads a clock`).not.toMatch(/Date\.now\(\s*\)/);
    }
  });

  /**
   * The client islands on this page DO read the clock, and must keep reading it
   * only after mount. During prerender a "use client" component is still
   * server-rendered into the HTML, so a clock read in its render body would be
   * baked into a page that is now never regenerated — the live sun panel would
   * show one frozen minute of one frozen day for as long as the deploy lasts.
   * Reading in an effect keeps the server output deterministic and lets the
   * browser fill in today's real values.
   */
  it("keeps the client islands' clock reads inside effects", () => {
    for (const file of ["hooks/useSolarPhase.ts", "components/SunTimesPanel.tsx"]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      const firstEffect = text.indexOf("useEffect(");
      const firstClock = text.search(/new Date\(\s*\)|Date\.now\(\s*\)/);
      expect(firstEffect, `${file} has no useEffect`).toBeGreaterThan(-1);
      expect(firstClock, `${file} reads a clock before its first effect`).toBeGreaterThan(
        firstEffect,
      );
    }
  });
});
