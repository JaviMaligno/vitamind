import { describe, it, expect } from "vitest";
import { localePathFromHref, alternatePathForLocale } from "@/i18n/locale-path";
import { routing } from "@/i18n/routing";

const LOCALES = routing.locales;

describe("localePathFromHref", () => {
  it("strips the locale segment, leaving the locale-local path", () => {
    expect(localePathFromHref("https://getvitamind.app/en/vitamin-d/london", LOCALES))
      .toBe("/vitamin-d/london");
    expect(localePathFromHref("https://getvitamind.app/lt/vitaminas-d/londonas", LOCALES))
      .toBe("/vitaminas-d/londonas");
  });

  it("leaves a prefix-free (default locale) path alone", () => {
    expect(localePathFromHref("https://getvitamind.app/vitamina-d/madrid", LOCALES))
      .toBe("/vitamina-d/madrid");
  });

  it("handles the home page in both forms", () => {
    expect(localePathFromHref("https://getvitamind.app/", LOCALES)).toBe("/");
    expect(localePathFromHref("https://getvitamind.app/fr", LOCALES)).toBe("/");
  });

  it("ignores the host, so a dev deploy never navigates to the canonical one", () => {
    expect(localePathFromHref("https://getvitamind.app/de/vitamin-d/london", LOCALES))
      .toBe("/vitamin-d/london");
  });

  it("does not mistake a path segment for a locale", () => {
    // "learn" is not a locale; nothing should be stripped.
    expect(localePathFromHref("https://getvitamind.app/learn", LOCALES)).toBe("/learn");
  });

  it("preserves query and hash", () => {
    expect(localePathFromHref("https://getvitamind.app/en/learn?a=1#supplement", LOCALES))
      .toBe("/learn?a=1#supplement");
  });

  it("accepts a relative href", () => {
    expect(localePathFromHref("/ru/vitamin-d/moscow", LOCALES)).toBe("/vitamin-d/moscow");
  });
});

describe("alternatePathForLocale", () => {
  /** A stand-in for the <head> links a page renders. */
  function docWith(links: Record<string, string>) {
    return {
      querySelector(selector: string) {
        const match = selector.match(/hreflang="([^"]+)"/);
        const locale = match?.[1] ?? "";
        const href = links[locale];
        if (!href) return null;
        return { getAttribute: (name: string) => (name === "href" ? href : null) } as unknown as Element;
      },
    };
  }

  // This is the bug: the language switcher reused the current pathname and only
  // swapped the locale segment, producing /en/vitamina-d/madrid, which 404s
  // because both the route prefix and the city slug are localized.
  it("returns the localized path of a city page, not the current one", () => {
    const doc = docWith({
      es: "https://getvitamind.app/vitamina-d/madrid",
      en: "https://getvitamind.app/en/vitamin-d/madrid",
      lt: "https://getvitamind.app/lt/vitaminas-d/madridas",
    });
    expect(alternatePathForLocale(doc, "en", LOCALES)).toBe("/vitamin-d/madrid");
    expect(alternatePathForLocale(doc, "lt", LOCALES)).toBe("/vitaminas-d/madridas");
    expect(alternatePathForLocale(doc, "es", LOCALES)).toBe("/vitamina-d/madrid");
  });

  it("handles a city whose slug differs per locale", () => {
    const doc = docWith({
      es: "https://getvitamind.app/vitamina-d/londres",
      en: "https://getvitamind.app/en/vitamin-d/london",
      fr: "https://getvitamind.app/fr/vitamine-d/londres",
      ru: "https://getvitamind.app/ru/vitamin-d/london",
    });
    expect(alternatePathForLocale(doc, "fr", LOCALES)).toBe("/vitamine-d/londres");
    // ru borrows the real Latin name rather than transliterating the Cyrillic.
    expect(alternatePathForLocale(doc, "ru", LOCALES)).toBe("/vitamin-d/london");
  });

  it("returns null when the page emits no alternates, so the caller can fall back", () => {
    expect(alternatePathForLocale(docWith({}), "en", LOCALES)).toBeNull();
  });

  it("returns null for a locale the page does not list", () => {
    const doc = docWith({ es: "https://getvitamind.app/vitamina-d/madrid" });
    expect(alternatePathForLocale(doc, "de", LOCALES)).toBeNull();
  });
});
