import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";
import { SUNRISE_CITIES } from "@/lib/sun-routes";
import { CITY_SLUGS } from "@/lib/city-slugs";

describe("sitemap", () => {
  const entries = sitemap();

  it("emits the static, city and sunrise-month URLs", () => {
    // 9 pages ×6 + 73 cities ×6 + every sunrise city ×12 months ×6.
    //
    // The sunrise term is derived from SUNRISE_CITIES rather than hardcoded, so adding
    // a wave does not require editing this number. What it still pins is the shape —
    // twelve months in six locales for each configured city — which is what would break
    // if a locale or a month were ever dropped from the generator.
    expect(entries).toHaveLength(54 + 438 + SUNRISE_CITIES.length * 12 * 6);
  });

  it("covers every configured sunrise city in every locale", () => {
    // Guards the gap the count alone cannot see: the right total with the wrong cities.
    const urls = entries.map((e) => e.url).join("\n");
    for (const base of SUNRISE_CITIES) {
      expect(urls, `no sunrise URLs for ${base}`).toContain(`/${CITY_SLUGS[base].en}/`);
    }
  });

  it("uses no prefix for es and /xx for other locales", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/learn`);      // es
    expect(urls).toContain(`${SITE_URL}/en/learn`);   // en
    expect(urls).toContain(`${SITE_URL}/`);           // es home
    expect(urls).toContain(`${SITE_URL}/fr`);         // fr home
  });

  it("has no legacy ?locale= URLs", () => {
    expect(entries.every((e) => !e.url.includes("?locale="))).toBe(true);
  });

  it("attaches language alternates to every entry", () => {
    for (const e of entries) {
      expect(Object.keys(e.alternates?.languages ?? {})).toContain("en");
    }
  });

  it("x-default points at the es (prefix-free) version of the same path", () => {
    const learnEs = entries.find((e) => e.url === `${SITE_URL}/learn`);
    expect(learnEs?.alternates?.languages?.["x-default"]).toBe(`${SITE_URL}/learn`);
  });

  it("emits the localized city URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/vitamina-d/madrid`);
    expect(urls).toContain(`${SITE_URL}/en/vitamin-d/london`);
    expect(urls).toContain(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(urls).toContain(`${SITE_URL}/lt/vitaminas-d/londonas`);
    // ru borrows the real Latin name; it is not a back-transliteration.
    expect(urls).toContain(`${SITE_URL}/ru/vitamin-d/london`);
  });

  it("gives each city entry six hreflang alternates plus x-default", () => {
    const london = entries.find((e) => e.url === `${SITE_URL}/en/vitamin-d/london`);
    expect(london?.alternates?.languages?.es).toBe(`${SITE_URL}/vitamina-d/londres`);
    expect(london?.alternates?.languages?.fr).toBe(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(london?.alternates?.languages?.["x-default"]).toBe(`${SITE_URL}/vitamina-d/londres`);
    expect(Object.keys(london?.alternates?.languages ?? {})).toHaveLength(7); // 6 + x-default
  });

  it("has no duplicate URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  /**
   * The sitemap's static list is hand-maintained, so adding a route and forgetting
   * this file is silent: the page ships, ranks nowhere, and never reaches IndexNow.
   * That is exactly how /about was born missing. Rather than pin the one route,
   * derive the expectation from the filesystem so the next one fails loudly here.
   */
  it("lists every indexable static route that exists on disk", () => {
    const dir = join(process.cwd(), "app", "[locale]");
    const onDisk = readdirSync(dir, { withFileTypes: true })
      // Dynamic segments ([cityPrefix]) expand into the city and sunrise entries
      // the tests above already cover; only fixed paths belong in the static list.
      .filter((e) => e.isDirectory() && !e.name.startsWith("["))
      .filter((e) => existsSync(join(dir, e.name, "page.tsx")))
      .map((e) => `/${e.name}`);

    // Deliberately absent, each for a reason that is not "we forgot":
    const NOT_INDEXABLE = [
      "/oauth-consent", // reached only mid-OAuth flow, with query params
      "/offline", // service-worker fallback, meaningless as a landing page
      "/reset-password", // reached only from a tokenized email link
    ];

    const expected = onDisk.filter((p) => !NOT_INDEXABLE.includes(p));
    const missing = expected.filter(
      (p) => !entries.some((e) => e.url === `${SITE_URL}${p}`),
    );
    expect(missing).toEqual([]);
  });
});
