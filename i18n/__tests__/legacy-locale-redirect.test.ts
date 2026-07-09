import { describe, it, expect } from "vitest";
import { legacyLocaleRedirect } from "@/i18n/legacy-locale-redirect";

describe("legacyLocaleRedirect", () => {
  it("maps ?locale=fr on /learn to /fr/learn", () => {
    expect(legacyLocaleRedirect("/learn", new URLSearchParams("locale=fr")))
      .toBe("/fr/learn");
  });

  it("maps ?locale=es to the prefix-free default path", () => {
    expect(legacyLocaleRedirect("/learn", new URLSearchParams("locale=es")))
      .toBe("/learn");
  });

  it("maps ?locale=en on / to /en", () => {
    expect(legacyLocaleRedirect("/", new URLSearchParams("locale=en")))
      .toBe("/en");
  });

  it("returns null when no locale param", () => {
    expect(legacyLocaleRedirect("/learn", new URLSearchParams(""))).toBeNull();
  });

  it("returns null for an unsupported locale", () => {
    expect(legacyLocaleRedirect("/learn", new URLSearchParams("locale=zz"))).toBeNull();
  });
});
