import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

describe("sitemap", () => {
  const entries = sitemap();

  it("emits the static, city and sunrise-month URLs", () => {
    // 7 pages ×6 + 73 cities ×6 + 28 sunrise cities ×12 months ×6
    expect(entries).toHaveLength(42 + 438 + 2016);
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
});
