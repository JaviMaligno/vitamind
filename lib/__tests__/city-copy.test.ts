import { describe, it, expect } from "vitest";
import {
  capFirst, monthName, monthGenitive, frAtCity, frFromMonth,
  monthLabels, cityLabels, verdictMonths,
} from "@/lib/city-copy";

describe("capFirst", () => {
  it("uppercases only the first character", () => {
    expect(capFirst("enero")).toBe("Enero");
    expect(capFirst("январь")).toBe("Январь");
    expect(capFirst("sausis")).toBe("Sausis");
    expect(capFirst("")).toBe("");
  });
});

describe("monthName", () => {
  it("returns the nominative long month", () => {
    expect(monthName("es", 0)).toBe("enero");
    expect(monthName("en", 0)).toBe("January");
    expect(monthName("ru", 0)).toBe("январь");
    expect(monthName("lt", 0)).toBe("sausis");
  });
});

describe("monthGenitive", () => {
  it("returns the genitive for ru (strips the day)", () => {
    expect(monthGenitive("ru", 0)).toBe("января");
    expect(monthGenitive("ru", 5)).toBe("июня");
    expect(monthGenitive("ru", 11)).toBe("декабря");
  });

  it("returns the genitive for lt (strips the day and the 'd.' marker)", () => {
    expect(monthGenitive("lt", 0)).toBe("sausio");
    expect(monthGenitive("lt", 5)).toBe("birželio");
    expect(monthGenitive("lt", 11)).toBe("gruodžio");
  });

  it("falls back to the nominative for locales without a genitive form", () => {
    expect(monthGenitive("es", 0)).toBe("enero");
    expect(monthGenitive("en", 0)).toBe("January");
    expect(monthGenitive("de", 0)).toBe("Januar");
    expect(monthGenitive("fr", 0)).toBe("janvier");
  });

  it("never leaves digits or stray punctuation behind", () => {
    for (const locale of ["ru", "lt"]) {
      for (let m = 0; m < 12; m++) {
        const g = monthGenitive(locale, m);
        expect(g).not.toMatch(/[0-9.]/);
        expect(g).toBe(g.trim());
        expect(g.length).toBeGreaterThan(2);
      }
    }
  });
});

describe("frAtCity", () => {
  it("contracts the French definite article", () => {
    expect(frAtCity("Le Caire")).toBe("au Caire");
    expect(frAtCity("Le Cap")).toBe("au Cap");
  });

  it("leaves Spanish articles alone", () => {
    expect(frAtCity("Las Palmas")).toBe("à Las Palmas");
    expect(frAtCity("Los Angeles")).toBe("à Los Angeles");
  });

  it("handles the plain case and the other French articles", () => {
    expect(frAtCity("Londres")).toBe("à Londres");
    expect(frAtCity("Les Sables")).toBe("aux Sables");
    expect(frAtCity("La Havane")).toBe("à la Havane");
    expect(frAtCity("L'Aquila")).toBe("à l'Aquila");
  });
});

describe("frFromMonth", () => {
  it("elides before a vowel-initial month", () => {
    expect(frFromMonth("avril")).toBe("d'avril");
    expect(frFromMonth("août")).toBe("d'août");
    expect(frFromMonth("octobre")).toBe("d'octobre");
  });

  it("does not elide otherwise", () => {
    expect(frFromMonth("mars")).toBe("de mars");
    expect(frFromMonth("septembre")).toBe("de septembre");
  });
});

describe("monthLabels", () => {
  it("returns 12 labels", () => {
    for (const l of ["es", "en", "fr", "de", "ru", "lt"]) {
      expect(monthLabels(l)).toHaveLength(12);
    }
  });

  it("uses letters for lt instead of Intl's numeric labels", () => {
    const lt = monthLabels("lt");
    expect(lt[0]).toBe("saus.");
    expect(lt[5]).toBe("birž.");
    expect(lt.every((l) => !/^\d+$/.test(l))).toBe(true);
  });

  it("uses Intl narrow labels elsewhere", () => {
    expect(monthLabels("en")[0]).toBe("J");
  });
});

describe("cityLabels", () => {
  it("exposes the French contracted forms for fr", () => {
    expect(cityLabels("fr", "Le Caire")).toEqual({
      city: "Le Caire", atCity: "au Caire", atCityCap: "Au Caire",
    });
    expect(cityLabels("fr", "Londres").atCityCap).toBe("À Londres");
  });

  it("falls back to the plain name for non-fr locales", () => {
    expect(cityLabels("es", "Madrid")).toEqual({
      city: "Madrid", atCity: "Madrid", atCityCap: "Madrid",
    });
  });
});

describe("verdictMonths", () => {
  it("ru: genitive start, nominative end (по governs the accusative)", () => {
    expect(verdictMonths("ru", 0, 5)).toMatchObject({
      startMonth: "января", endMonth: "июнь",
    });
  });

  it("lt: genitive on both months", () => {
    expect(verdictMonths("lt", 0, 5)).toMatchObject({
      startMonth: "sausio", endMonth: "birželio",
    });
  });

  it("fr: supplies the elided de/d' forms", () => {
    expect(verdictMonths("fr", 3, 8)).toMatchObject({
      fromMonth: "d'avril", fromMonthCap: "D'avril", endMonth: "septembre",
    });
    expect(verdictMonths("fr", 2, 8).fromMonth).toBe("de mars");
  });

  it("es/en/de: plain nominative on both", () => {
    expect(verdictMonths("es", 0, 5)).toMatchObject({ startMonth: "enero", endMonth: "junio" });
    expect(verdictMonths("en", 0, 5)).toMatchObject({ startMonth: "January", endMonth: "June" });
    expect(verdictMonths("de", 0, 5)).toMatchObject({ startMonth: "Januar", endMonth: "Juni" });
  });
});
