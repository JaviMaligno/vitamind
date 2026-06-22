import { describe, it, expect } from "vitest";
import { pickLocale } from "./accept-language";

const SUPPORTED = ["es", "en", "fr", "de", "ru", "lt"] as const;

describe("pickLocale", () => {
  it("falls back when header is missing", () => {
    expect(pickLocale(null, SUPPORTED, "es")).toBe("es");
    expect(pickLocale(undefined, SUPPORTED, "es")).toBe("es");
    expect(pickLocale("", SUPPORTED, "es")).toBe("es");
  });

  it("picks the highest-quality supported language", () => {
    expect(pickLocale("en-US,en;q=0.9,es;q=0.8", SUPPORTED, "es")).toBe("en");
  });

  it("matches the primary subtag, ignoring region", () => {
    expect(pickLocale("fr-FR", SUPPORTED, "es")).toBe("fr");
    expect(pickLocale("de-AT,de;q=0.9", SUPPORTED, "es")).toBe("de");
  });

  it("respects q-value ordering over source order", () => {
    expect(pickLocale("es;q=0.7,en;q=0.9", SUPPORTED, "es")).toBe("en");
  });

  it("skips unsupported languages and keeps scanning", () => {
    expect(pickLocale("zh-CN,ja;q=0.9,fr;q=0.5", SUPPORTED, "es")).toBe("fr");
  });

  it("falls back when nothing is supported", () => {
    expect(pickLocale("zh-CN,ja;q=0.9", SUPPORTED, "es")).toBe("es");
    expect(pickLocale("*", SUPPORTED, "es")).toBe("es");
  });

  it("ignores zero-quality entries", () => {
    expect(pickLocale("en;q=0,fr;q=0.5", SUPPORTED, "es")).toBe("fr");
  });
});
