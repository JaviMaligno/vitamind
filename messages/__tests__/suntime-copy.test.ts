import { describe, it, expect } from "vitest";

import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";
import { BANDS } from "@/lib/suntime-routes";

const LOCALES: Record<string, unknown> = { es, en, fr, de, ru, lt };

/**
 * The copy for the four "how long in the sun" pages, in six languages.
 *
 * The rule this file exists to enforce is CLAUDE.md's: a number in
 * `messages/*.json` is a claim about `lib/` that nothing re-derives. Five such
 * claims shipped to production and lived there for weeks — "45°" in the footer
 * of every page, then copied into `/methodology`, where writing a new page
 * propagated the error instead of catching it. So no minute figure is written
 * here at all: every one arrives by interpolation from `lib/suntime-content.ts`.
 */

/** Shared chrome, used by all four pages. */
const SHARED_KEYS = [
  "eyebrow",
  "assumptionsHeading",
  "assumptionArea",
  "assumptionAge",
  "assumptionTarget",
  "assumptionPlace",
  "targetNote",
  "methodHeading",
  "methodBody",
  "disclaimer",
  "monthHeading",
  "monthNote",
  "monthRange",
  "monthImpossible",
  "impossibleHeading",
  "impossibleSome",
  "impossibleNone",
  "burnHeading",
  "burnBody",
  "typesHeading",
  "typeRow",
  "otherBandsHeading",
  "ctaLabel",
  "backToMother",
];

const MOTHER_KEYS = [
  "title",
  "metaDescription",
  "h1",
  "lead",
  "answer",
  "whyHeading",
  "whyBody",
  "chooseHeading",
];

const BAND_KEYS = [
  "title",
  "metaDescription",
  "h1",
  "lead",
  "answer",
  "angleHeading",
  "angleBody",
  "gloss",
  "cardBlurb",
];

function page(locale: string): Record<string, unknown> {
  const root = LOCALES[locale] as Record<string, unknown>;
  return (root.suntimePage ?? {}) as Record<string, unknown>;
}

/** Every string in the namespace, flattened, with its dotted key. */
function strings(locale: string): [string, string][] {
  const out: [string, string][] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") return void out.push([path, node]);
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(page(locale), "");
  return out;
}

describe("the sun-time namespace exists in all six languages", () => {
  it.each(Object.keys(LOCALES))("%s has the shared chrome", (locale) => {
    const p = page(locale);
    for (const key of SHARED_KEYS) {
      expect(typeof p[key], `${locale}.suntimePage.${key}`).toBe("string");
      expect((p[key] as string).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(LOCALES))("%s has the mother page", (locale) => {
    const mother = (page(locale).mother ?? {}) as Record<string, unknown>;
    for (const key of MOTHER_KEYS) {
      expect(typeof mother[key], `${locale}.suntimePage.mother.${key}`).toBe("string");
      expect((mother[key] as string).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(LOCALES))("%s has all three band pages", (locale) => {
    const bands = (page(locale).bands ?? {}) as Record<string, Record<string, unknown>>;
    for (const band of BANDS) {
      for (const key of BAND_KEYS) {
        expect(typeof bands[band]?.[key], `${locale}.suntimePage.bands.${band}.${key}`).toBe(
          "string",
        );
      }
    }
  });

  it("gives every locale the same key set — no locale silently short", () => {
    // next-intl does NOT throw on a missing message: its default fallback joins
    // namespace and key, so a forgotten key renders the literal string
    // `suntimePage.mother.h1` into HTML Google indexes, with a 200. A count
    // comparison is the only thing that catches it before a crawler does.
    const reference = strings("es").map(([k]) => k).sort();
    for (const locale of Object.keys(LOCALES)) {
      expect(strings(locale).map(([k]) => k).sort(), `${locale} key set`).toEqual(reference);
    }
  });
});

describe("no minute figure is written by hand", () => {
  /**
   * The whole point. A figure typed here is a claim about `minutesForVitD` that
   * nothing re-derives, and CLAUDE.md tabulates five that went stale in
   * production. Digits are allowed — `targetNote` cites other bodies'
   * recommendations of 600, 800 and 2000 IU, which are facts about those bodies
   * and not about this model — but a duration is not.
   */
  const MINUTES = /\d+([.,]\d+)?\s*(min\b|minut|мин|Minuten)/i;

  it.each(Object.keys(LOCALES))("%s writes no literal duration", (locale) => {
    for (const [key, value] of strings(locale)) {
      expect(value, `${locale}.suntimePage.${key} hard-codes a duration`).not.toMatch(MINUTES);
    }
  });

  it.each(Object.keys(LOCALES))("%s interpolates the figures it quotes", (locale) => {
    const p = page(locale);
    // The rows that print numbers must carry the placeholders that supply them,
    // or the page renders a sentence with a hole in it.
    expect(p.monthRange as string).toMatch(/\{min\}/);
    expect(p.monthRange as string).toMatch(/\{max\}/);
    expect(p.typeRow as string).toMatch(/\{min\}/);
    expect(p.burnBody as string).toMatch(/\{minutes\}/);
    expect(p.burnBody as string).toMatch(/\{burnMinutes\}/);
  });
});

describe("the assumptions are declared, all three of them", () => {
  /**
   * Spec §9. A hidden assumption is what makes somebody else's figure look
   * authoritative — the AI Overview answers "10 to 15 minutes" and one of its
   * own sources qualifies itself with "Fitzpatrick II-III at ~40°N" in small
   * print. These pages exist to put that qualification in the open, so the
   * three parameters have to be interpolated and visible rather than implied.
   */
  it.each(Object.keys(LOCALES))("%s interpolates area, age and target", (locale) => {
    const p = page(locale);
    expect(p.assumptionArea as string).toMatch(/\{areaPercent\}/);
    expect(p.assumptionAge as string).toMatch(/\{age\}/);
    expect(p.assumptionTarget as string).toMatch(/\{targetIU\}/);
    expect(p.assumptionPlace as string).toMatch(/\{lat\}/);
  });

  it.each(Object.keys(LOCALES))("%s says the target is a choice, not a consensus", (locale) => {
    // 1000 IU is this product's pick; 600, 800 and 2000 all have bodies behind
    // them. Printing one number without saying so is the defect being corrected.
    const note = page(locale).targetNote as string;
    expect(note.length).toBeGreaterThan(40);
    expect(note).toMatch(/600/);
    expect(note).toMatch(/2000|2 000|2\.000|2 000/);
  });

  it.each(Object.keys(LOCALES))("%s carries a disclaimer", (locale) => {
    expect((page(locale).disclaimer as string).length).toBeGreaterThan(40);
  });
});

describe("the medical claims stay inside what is authorised", () => {
  /**
   * `messages/__tests__/health-claims.test.ts` guards `cityPage.supplementBody`
   * and one `/learn` answer by name; it does not scan this namespace. Rather
   * than widen a file built around two specific paragraphs, the same two rules
   * are applied here — Reg. (EU) 432/2012 authorises health claims per single
   * nutrient, so no combination claim, and EFSA REJECTED vitamin K2 for heart
   * and blood vessels (ID 125, EFSA Journal 2012;10(7):2714).
   */
  const SYNERGY: Record<string, RegExp> = {
    es: /absorci|asimilaci|sinerg/i,
    en: /absorption|uptake|synerg/i,
    fr: /absorption|assimilation|synerg/i,
    de: /Aufnahme|Verwertung|Resorption|synerg/i,
    ru: /усвоен|всасыван|синерг/i,
    lt: /pasisavin|įsisavin|sinerg/i,
  };
  const CARDIOVASCULAR: Record<string, RegExp> = {
    es: /arteri|coraz[oó]n|cardiovas/i,
    en: /arter|heart|cardiovas/i,
    fr: /art[èe]r|c(?:œ|oe)ur|cardiovas/i,
    de: /Arterien|Herz|kardiovas/i,
    ru: /артери|сердц|сосуд/i,
    lt: /arterij|[šs]ird|kraujagysl/i,
  };

  it.each(Object.keys(LOCALES))("%s claims no synergy or absorption effect", (locale) => {
    for (const [key, value] of strings(locale)) {
      expect(value, `${locale}.suntimePage.${key}`).not.toMatch(SYNERGY[locale]);
    }
  });

  it.each(Object.keys(LOCALES))("%s makes no cardiovascular claim", (locale) => {
    for (const [key, value] of strings(locale)) {
      expect(value, `${locale}.suntimePage.${key}`).not.toMatch(CARDIOVASCULAR[locale]);
    }
  });

  it.each(Object.keys(LOCALES))("%s never tells the reader to take something", (locale) => {
    // Same rule cityPage.supplementBody lives under: this site describes when
    // synthesis is and is not possible. It does not prescribe.
    const PRESCRIBES: Record<string, RegExp> = {
      es: /te recomendamos|recomendamos tomar|debes tomar/i,
      en: /we recommend taking|you should take/i,
      fr: /nous recommandons de prendre|vous devez prendre/i,
      de: /wir empfehlen.*einzunehmen|Sie sollten.*einnehmen/i,
      ru: /мы рекомендуем принимать|вам следует принимать/i,
      lt: /rekomenduojame vartoti|turėtumėte vartoti/i,
    };
    for (const [key, value] of strings(locale)) {
      expect(value, `${locale}.suntimePage.${key}`).not.toMatch(PRESCRIBES[locale]);
    }
  });
});

describe("the three band pages are three pages, not one with a scaled number", () => {
  /**
   * The failure mode the spec spends §3 on, and the one the 438 city pages
   * already demonstrate at 0.08 impressions each. Each band was written from its
   * own angle — burn risk, the default case, deficiency prevalence — so the
   * bodies must not be near-copies of each other.
   *
   * Checked on es and en only: those two are final. fr, de, ru and lt are
   * best-effort pending native review and would fail a similarity test for
   * reasons that are about the translation, not about the argument.
   */
  it.each(["es", "en"])("%s writes a distinct body for each band", (locale) => {
    const bands = (page(locale).bands ?? {}) as Record<string, Record<string, string>>;
    const bodies = BANDS.map((b) => bands[b].angleBody);
    expect(new Set(bodies).size).toBe(3);

    // Word overlap, not identity: two paragraphs that differ only in a number
    // would pass a uniqueness check and still be the same page twice.
    const words = (s: string) => new Set(s.toLowerCase().match(/\p{L}{5,}/gu) ?? []);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = words(bodies[i]);
        const b = words(bodies[j]);
        const shared = [...a].filter((w) => b.has(w)).length;
        const overlap = shared / Math.min(a.size, b.size);
        expect(overlap, `${BANDS[i]} and ${BANDS[j]} say the same thing`).toBeLessThan(0.5);
      }
    }
  });

  it.each(["es", "en"])("%s gives each band its own title and description", (locale) => {
    const bands = (page(locale).bands ?? {}) as Record<string, Record<string, string>>;
    expect(new Set(BANDS.map((b) => bands[b].title)).size).toBe(3);
    expect(new Set(BANDS.map((b) => bands[b].metaDescription)).size).toBe(3);
  });
});
