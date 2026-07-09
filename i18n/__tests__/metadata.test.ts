import { describe, it, expect } from "vitest";
import { buildAlternates } from "@/i18n/metadata";
import { SITE_URL } from "@/lib/site";

describe("buildAlternates", () => {
  it("self-references the current locale as canonical", () => {
    expect(buildAlternates("en", "/learn").canonical).toBe(`${SITE_URL}/en/learn`);
    expect(buildAlternates("es", "/learn").canonical).toBe(`${SITE_URL}/learn`);
  });

  it("lists all 6 language alternates plus x-default", () => {
    const langs = buildAlternates("es", "/learn").languages as Record<string, string>;
    expect(langs.es).toBe(`${SITE_URL}/learn`);
    expect(langs.en).toBe(`${SITE_URL}/en/learn`);
    expect(langs.fr).toBe(`${SITE_URL}/fr/learn`);
    expect(langs["x-default"]).toBe(`${SITE_URL}/`);
  });
});
