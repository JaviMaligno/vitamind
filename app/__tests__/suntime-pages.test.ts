import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import {
  BANDS,
  BAND_SLUGS,
  SUNTIME_PREFIX,
  allSuntimePathnames,
  buildSuntimeAlternates,
  buildSuntimeBandAlternates,
} from "@/lib/suntime-routes";

const ROOT = resolve(__dirname, "../..");
const LOCALE_DIR = join(ROOT, "app/[locale]");
const SHARED_DIR = join(LOCALE_DIR, "_suntime");

/**
 * THE TWELVE STATIC FOLDERS, AND THE TRAP THEY SET.
 *
 * These pages cannot use a dynamic first segment: `app/[locale]/[cityPrefix]/`
 * already holds that position and Next allows one slug name per position. So
 * they get a folder per locale per level, exactly as the sunrise hubs did for
 * their own reason — and they inherit the same hazard. Twelve directory names
 * now duplicate six values of `SUNTIME_PREFIX` with nothing in the type system
 * connecting them. Rename a prefix and its four pages quietly stop being
 * routed: URLs that sit in the sitemap, are prerendered by nothing and 404.
 *
 * This file is the tripwire, modelled on app/__tests__/sun-hub-split.test.ts.
 * It reassembles the route set FROM DISK and compares it with the table. Do not
 * delete it.
 *
 * Asserts read source rather than render, the convention the neighbouring route
 * tests already follow.
 */

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function motherDir(prefix: string): string {
  return join(LOCALE_DIR, prefix);
}

function bandDir(prefix: string): string {
  return join(LOCALE_DIR, prefix, "[band]");
}

describe("the twelve route folders exist and match the table", () => {
  it("has a mother folder for every locale, named after its prefix", () => {
    for (const locale of routing.locales) {
      const dir = motherDir(SUNTIME_PREFIX[locale]);
      expect(existsSync(join(dir, "page.tsx")), `missing ${dir}/page.tsx`).toBe(true);
    }
  });

  it("has a band folder under each mother", () => {
    for (const locale of routing.locales) {
      const dir = bandDir(SUNTIME_PREFIX[locale]);
      expect(existsSync(join(dir, "page.tsx")), `missing ${dir}/page.tsx`).toBe(true);
    }
  });

  it("pins each folder's PREFIX literal to its own directory name", () => {
    // The literal cannot be read from SUNTIME_PREFIX: a value looked up at
    // runtime could drift away from the directory the file actually sits in,
    // and then the folder routes nothing while the table still claims it does.
    for (const locale of routing.locales) {
      const prefix = SUNTIME_PREFIX[locale];
      for (const dir of [motherDir(prefix), bandDir(prefix)]) {
        const source = read(join(dir, "page.tsx"));
        const declared = source.match(/const PREFIX = "([^"]+)"/)?.[1];
        expect(declared, `${dir}/page.tsx does not declare its PREFIX`).toBe(prefix);
      }
    }
  });

  it("adds no folder the table does not know about", () => {
    // The other direction: a leftover folder from a renamed prefix serves a URL
    // that nothing else on the site links to or lists.
    const known = new Set(Object.values(SUNTIME_PREFIX));
    const suspects = readdirSync(LOCALE_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => /vitamin|sol|soleil|sonne|solnca|saules/.test(name))
      .filter((name) => !name.startsWith("[") && !name.startsWith("_"));
    for (const name of suspects) {
      const isSunHub = existsSync(join(LOCALE_DIR, name, "[city]"));
      if (isSunHub) continue;
      expect(known.has(name), `app/[locale]/${name} is not in SUNTIME_PREFIX`).toBe(true);
    }
  });

  it("keeps the shared implementation in one place", () => {
    expect(existsSync(join(SHARED_DIR, "suntime-route.tsx"))).toBe(true);
    expect(existsSync(join(SHARED_DIR, "SuntimePage.tsx"))).toBe(true);
  });
});

describe("the pages are static, like the city pages and unlike the hubs", () => {
  it("declares revalidate = false on every route file", () => {
    // A pure function of (latitude, DOY_REFERENCE_YEAR, the model) — nothing on
    // the render path reads a clock. Putting them in the ISR class would bill
    // write units on a quota that closed its last 30-day window at 181%.
    for (const locale of routing.locales) {
      const prefix = SUNTIME_PREFIX[locale];
      for (const dir of [motherDir(prefix), bandDir(prefix)]) {
        expect(read(join(dir, "page.tsx"))).toMatch(/export const revalidate = false/);
      }
    }
  });

  it("prerenders every locale and every band", () => {
    for (const locale of routing.locales) {
      const prefix = SUNTIME_PREFIX[locale];
      for (const dir of [motherDir(prefix), bandDir(prefix)]) {
        expect(read(join(dir, "page.tsx"))).toMatch(/generateStaticParams/);
      }
    }
  });
});

describe("the markup is Article, and none of the three dead types", () => {
  /**
   * Spec §6, researched against Google's own documentation on 2026-08-27. All
   * three types the draft considered are gone: `HowTo` was retired in 2023;
   * `FAQPage` stopped producing a rich result on 2026-05-07 and its
   * documentation was deleted on 2026-06-15, so the health-site exception no
   * longer exists; and `MedicalWebPage` was never a type Google read at all.
   * `Article` is the only one with a real rich result left.
   */
  const source = () => read(join(SHARED_DIR, "SuntimePage.tsx"));

  it("emits an Article node", () => {
    expect(source()).toMatch(/"@type":\s*"Article"|@type: "Article"|'Article'/);
  });

  it("emits none of FAQPage, HowTo or MedicalWebPage", () => {
    for (const dead of ["FAQPage", "HowTo", "MedicalWebPage"]) {
      expect(source(), `${dead} is a dead rich-result type`).not.toContain(dead);
    }
  });

  it("carries a BreadcrumbList for the mother-to-child hierarchy", () => {
    expect(source()).toContain("BreadcrumbList");
  });
});

describe("the answer is in the visible HTML, not only in the markup", () => {
  /**
   * The binding corollary of spec §6. Measured by Ahrefs over 1,885 pages that
   * added JSON-LD against 4,000 controls: −4.6% in AI Overviews, significant.
   * Another study found all five systems tested extract visible HTML and ignore
   * JSON-LD outright. So a number that lives only in the structured data does
   * not count, and the page has to print it in the body.
   */
  const source = () => read(join(SHARED_DIR, "SuntimePage.tsx"));

  it("prints the range through the copy, with the figures interpolated", () => {
    // `answer` is the sentence that carries the two numbers, and it must reach
    // the body — not a meta tag, not a JSON-LD field.
    expect(source()).toMatch(/t\(\s*["'`][\w.]*answer/);
    expect(source()).toMatch(/min:/);
    expect(source()).toMatch(/max:/);
  });

  it("prints the month table and the impossible months", () => {
    expect(source()).toMatch(/monthRange|monthImpossible/);
    expect(source()).toMatch(/impossibleSome|impossibleNone/);
  });

  it("states the assumptions on the page", () => {
    for (const key of ["assumptionArea", "assumptionAge", "assumptionTarget", "targetNote"]) {
      expect(source(), `${key} never reaches the page`).toContain(key);
    }
  });

  it("carries the disclaimer", () => {
    expect(source()).toContain("disclaimer");
  });
});

describe("canonicals and hreflang", () => {
  it("gives every one of the 24 a canonical pointing at itself", () => {
    for (const locale of routing.locales) {
      expect(buildSuntimeAlternates(locale).canonical).toContain(SUNTIME_PREFIX[locale]);
      for (const band of BANDS) {
        const { canonical } = buildSuntimeBandAlternates(locale, band);
        expect(canonical).toContain(SUNTIME_PREFIX[locale]);
        expect(canonical).toContain(BAND_SLUGS[locale][band]);
      }
    }
  });

  it("links all six locales, plus x-default, in both directions", () => {
    for (const locale of routing.locales) {
      const { languages } = buildSuntimeAlternates(locale);
      expect(Object.keys(languages).sort()).toEqual(
        [...routing.locales, "x-default"].sort(),
      );
      for (const band of BANDS) {
        const alt = buildSuntimeBandAlternates(locale, band).languages;
        expect(Object.keys(alt).sort()).toEqual([...routing.locales, "x-default"].sort());
        // Each alternate must be that locale's OWN slug, not this one's.
        for (const other of routing.locales) {
          expect(alt[other]).toContain(BAND_SLUGS[other][band]);
        }
      }
    }
  });

  it("never points a locale's alternate at another locale's URL", () => {
    const seen = new Map<string, string>();
    for (const { locale, pathname } of allSuntimePathnames()) {
      const url = getPathname({ href: pathname, locale: locale as (typeof routing.locales)[number] });
      expect(seen.has(url), `${url} is claimed twice`).toBe(false);
      seen.set(url, locale);
    }
    expect(seen.size).toBe(24);
  });
});

describe("the pages are indexable — unlike the on-demand city pages", () => {
  it("never marks itself noindex", () => {
    const source = read(join(SHARED_DIR, "suntime-route.tsx"));
    expect(source).not.toMatch(/noindex/i);
  });
});
