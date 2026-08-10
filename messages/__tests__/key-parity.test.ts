import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

/**
 * A missing key does not fail the build — next-intl renders the key name, so a
 * half-translated namespace ships silently and only shows up as gibberish on a
 * page nobody happened to open in Lithuanian.
 */
const flatten = (obj: unknown, prefix = ""): string[] =>
  typeof obj === "object" && obj !== null && !Array.isArray(obj)
    ? Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      )
    : [prefix];

const LOCALES = { en, fr, de, ru, lt } as const;

describe("message key parity", () => {
  const base = flatten(es).sort();

  it.each(Object.keys(LOCALES))("%s has exactly the keys es has", (locale) => {
    const other = flatten(LOCALES[locale as keyof typeof LOCALES]).sort();
    expect(other.filter((k) => !base.includes(k))).toEqual([]);
    expect(base.filter((k) => !other.includes(k))).toEqual([]);
  });

  it("es defines the about namespace", () => {
    expect(base).toContain("about.metaTitle");
    expect(base).toContain("about.heading");
    expect(base).toContain("about.body");
    expect(base).toContain("about.whyHeading");
    expect(base).toContain("about.whyBody");
  });
});
