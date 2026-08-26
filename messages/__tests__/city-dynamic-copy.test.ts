import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

const LOCALES = { es, en, fr, de, ru, lt } as Record<string, { cityPage: Record<string, string> }>;
const NEW_KEYS = ["dynamicProvenance", "dynamicNameLatin"] as const;

describe("on-demand city page copy", () => {
  /**
   * next-intl does NOT throw on a missing message: it renders the literal
   * "cityPage.dynamicProvenance" into HTML with a 200 status. A missing key is
   * silently degraded copy, not a crash, which is why this is pinned.
   */
  it("exists in all six locales", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of NEW_KEYS) {
        expect(messages.cityPage[key], `${locale}.cityPage.${key}`).toBeTruthy();
      }
    }
  });

  it("interpolates the city name in the provenance line", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      expect(messages.cityPage.dynamicProvenance, locale).toContain("{city}");
    }
  });

  /**
   * CLAUDE.md's hard rule: any factual claim in messages/*.json that names a
   * threshold, an angle, a duration or a criterion is a claim about lib/ and has
   * to be verified against the module that computes it. Five stale claims reached
   * production that way. These two keys satisfy it BY CONSTRUCTION: no numbers.
   */
  it("states no figure, so there is nothing to go stale", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of NEW_KEYS) {
        expect(messages.cityPage[key], `${locale}.${key}`).not.toMatch(/\d/);
      }
    }
  });
});
