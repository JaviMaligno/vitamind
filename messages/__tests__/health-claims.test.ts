import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

const LOCALES = { es, en, fr, de, ru, lt } as Record<
  string,
  { cityPage: { supplementBody: string } }
>;

/**
 * The supplement paragraph ships on 45 indexed city pages in six languages, and
 * will be shown to a supplement brand. Two things must never appear in it.
 *
 * 1. A SYNERGY or ABSORPTION claim. Reg. (EU) 432/2012 authorises health claims
 *    strictly per single nutrient; there is no authorised claim for vitamin D
 *    combined with K2 or magnesium. Saying K2 and magnesium "help absorption"
 *    is an unauthorised health claim -- and five of the six locales said exactly
 *    that before this test existed.
 *
 * 2. A CARDIOVASCULAR claim for K2. EFSA assessed "vitamin K2 and normal
 *    function of the heart and blood vessels" (ID 125) and REJECTED it: no
 *    cause-and-effect relationship (EFSA Journal 2012;10(7):2714). It is the
 *    most common K2 marketing line and it is expressly not authorised.
 */
const SYNERGY = {
  es: /absorci|asimilaci|sinerg/i,
  en: /absorption|uptake|synerg/i,
  fr: /absorption|assimilation|synerg/i,
  de: /Aufnahme|Verwertung|Resorption|synerg/i,
  ru: /усвоен|всасыван|синерг/i,
  lt: /pasisavin|įsisavin|sinerg/i,
};

const CARDIOVASCULAR = {
  es: /arteri|coraz[oó]n|cardiovas/i,
  en: /arter|heart|cardiovas/i,
  fr: /art[èe]r|c(?:œ|oe)ur|cardiovas/i,
  de: /Arterien|Herz|kardiovas/i,
  ru: /артери|сердц|сосуд/i,
  lt: /arterij|[šs]ird|kraujagysl/i,
};

/**
 * The authorised bone claim is registered for the generic nutrient "vitamin K",
 * not for K2. Standard label practice, and what these strings do: name the
 * ingredient as K2, then state the claim under the generic name. The claim must
 * therefore follow the "(… K2)" form marker, not be predicated on K2 itself.
 */
const CLAIM_AFTER_FORM_MARKER = {
  es: /K2\), que contribuye al mantenimiento de los huesos en condiciones normales/,
  en: /K2\), which contributes to the maintenance of normal bones/,
  fr: /K2\), qui contribue au maintien d'une ossature normale/,
  de: /K2\), das zur Erhaltung normaler Knochen beiträgt/,
  ru: /K2\), который способствует поддержанию нормального состояния костей/,
  lt: /K2\), kuris padeda palaikyti normalią kaulų būklę/,
};

describe("cityPage.supplementBody health claims", () => {
  it.each(Object.keys(LOCALES))("%s makes no synergy or absorption claim", (locale) => {
    const body = LOCALES[locale].cityPage.supplementBody;
    expect(body).not.toMatch(SYNERGY[locale as keyof typeof SYNERGY]);
  });

  it.each(Object.keys(LOCALES))("%s makes no cardiovascular claim for K2", (locale) => {
    const body = LOCALES[locale].cityPage.supplementBody;
    expect(body).not.toMatch(CARDIOVASCULAR[locale as keyof typeof CARDIOVASCULAR]);
  });

  it.each(Object.keys(LOCALES))("%s attaches the bone claim to generic vitamin K", (locale) => {
    const body = LOCALES[locale].cityPage.supplementBody;
    expect(body).toMatch(CLAIM_AFTER_FORM_MARKER[locale as keyof typeof CLAIM_AFTER_FORM_MARKER]);
  });

  it("never says an authority recommends the combination", () => {
    // No health authority, guideline or medical society recommends D3 + K2 + magnesium.
    const forbidden = /recomienda|recommend|empfohlen|рекоменд|rekomenduoj/i;
    for (const locale of Object.keys(LOCALES)) {
      expect(LOCALES[locale].cityPage.supplementBody).not.toMatch(forbidden);
    }
  });
});
