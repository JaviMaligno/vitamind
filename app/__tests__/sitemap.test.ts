import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

describe("sitemap", () => {
  const entries = sitemap();

  it("emits 36 URLs (6 pages × 6 locales)", () => {
    expect(entries).toHaveLength(36);
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
});
