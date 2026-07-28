import { describe, it, expect } from "vitest";
import { crossLocaleRedirect } from "@/i18n/cross-locale-redirect";

/**
 * Every case below is a real URL from Search Console's "Not found (404)" report on
 * 2026-07-28 (118 of them). They all share one shape: the language switcher used to
 * swap only the locale segment and keep the original language's prefix and city slug,
 * so `/lt/vitaminas-d/fyniksas` became `/de/vitaminas-d/fyniksas` — German locale,
 * Lithuanian prefix, Lithuanian slug. The switcher was fixed on 2026-07-10 (it now
 * reads the page's hreflang links), so nothing generates these any more; these
 * redirects recover the ones Google already knows about.
 */
describe("crossLocaleRedirect on the real 404s", () => {
  it.each([
    // requested locale, wrong prefix + slug from another locale → correct target
    ["/de/vitaminas-d/fyniksas", "/de/vitamin-d/phoenix"],
    ["/fr/vitaminas-d/oklandas", "/fr/vitamine-d/auckland"],
    ["/en/vitaminas-d/roma", "/en/vitamin-d/rome"],
    ["/de/vitamina-d/praga", "/de/vitamin-d/prag"],
    ["/lt/vitamin-d/berlin", "/lt/vitaminas-d/berlynas"],
    ["/lt/vitamin-d/amsterdam", "/lt/vitaminas-d/amsterdamas"],
  ])("%s → %s", (from, to) => {
    expect(crossLocaleRedirect(from)).toBe(to);
  });

  it("recovers the index page too, which has no city segment", () => {
    expect(crossLocaleRedirect("/fr/vitamin-d")).toBe("/fr/vitamine-d");
  });

  it("recovers into the default locale, which carries no prefix in the URL", () => {
    expect(crossLocaleRedirect("/vitaminas-d/fyniksas")).toBe("/vitamina-d/phoenix");
  });
});

describe("crossLocaleRedirect leaves valid URLs alone", () => {
  it.each([
    "/vitamina-d/madrid",
    "/en/vitamin-d/london",
    "/lt/vitaminas-d/fyniksas",
    "/de/vitamin-d/rom",
    "/fr/vitamine-d",
    "/vitamina-d",
  ])("%s is already correct", (pathname) => {
    expect(crossLocaleRedirect(pathname)).toBeNull();
  });

  it.each(["/", "/learn", "/en/connect", "/dashboard", "/api/weather", "/profile"])(
    "%s is not a city URL",
    (pathname) => {
      expect(crossLocaleRedirect(pathname)).toBeNull();
    },
  );
});

describe("crossLocaleRedirect refuses to guess", () => {
  it("returns null for a city slug it cannot resolve, so the 404 stands", () => {
    // Redirecting an unknown slug somewhere plausible would turn an honest 404 into a
    // wrong page, which is worse: the user lands on a city that is not the one asked for.
    expect(crossLocaleRedirect("/de/vitaminas-d/not-a-city")).toBeNull();
  });

  it("returns null when the prefix belongs to no locale", () => {
    expect(crossLocaleRedirect("/de/vitamine-de/roma")).toBeNull();
  });

  it("returns null for a bogus locale segment rather than inventing one", () => {
    // "/df/..." appeared in the report; "df" is not a locale, so next-intl's own
    // handling should deal with it instead of this module.
    expect(crossLocaleRedirect("/df/vitaminas-d/roma")).toBeNull();
  });

  it("never returns the path it was given", () => {
    for (const p of ["/vitamina-d/madrid", "/en/vitamin-d/london", "/lt/vitaminas-d/fyniksas"]) {
      expect(crossLocaleRedirect(p)).not.toBe(p);
    }
  });
});

describe("crossLocaleRedirect on the sunrise family", () => {
  it("recovers a cross-locale sunrise URL, month included", () => {
    expect(crossLocaleRedirect("/fr/sonnenaufgang/singapur/dezember")).toBe(
      "/fr/lever-du-soleil/singapour/decembre",
    );
  });

  it("leaves a correct sunrise URL alone", () => {
    expect(crossLocaleRedirect("/de/sonnenaufgang/singapur/dezember")).toBeNull();
  });

  it("returns null when the month cannot be resolved", () => {
    expect(crossLocaleRedirect("/fr/sonnenaufgang/singapur/notamonth")).toBeNull();
  });
});
