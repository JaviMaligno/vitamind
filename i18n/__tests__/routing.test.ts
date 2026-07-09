import { describe, it, expect } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

describe("routing", () => {
  it("has the 6 supported locales and es default", () => {
    expect(routing.locales).toEqual(["es", "en", "fr", "de", "ru", "lt"]);
    expect(routing.defaultLocale).toBe("es");
  });

  it("default locale (es) has no prefix", () => {
    expect(getPathname({ href: "/learn", locale: "es" })).toBe("/learn");
    expect(getPathname({ href: "/", locale: "es" })).toBe("/");
  });

  it("non-default locales are prefixed", () => {
    expect(getPathname({ href: "/learn", locale: "en" })).toBe("/en/learn");
    expect(getPathname({ href: "/", locale: "fr" })).toBe("/fr");
  });
});
