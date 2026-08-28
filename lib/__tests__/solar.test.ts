import { describe, it, expect } from "vitest";
import { solarElev, vitDHrs, dayOfYear, getCurve, getWindow, fmtDate } from "../solar";

describe("solar calculations", () => {
  it("summer solstice at equator has high elevation", () => {
    const elev = solarElev(0, 0, 172, 12);
    expect(elev).toBeGreaterThan(60);
  });

  it("winter in Stockholm has zero vitD hours at threshold 50", () => {
    const hours = vitDHrs(59.3, 355, 50);
    expect(hours).toBe(0);
  });

  it("summer in Madrid has positive vitD hours", () => {
    const hours = vitDHrs(40.4, 172, 50);
    expect(hours).toBeGreaterThan(0);
  });

  it("getCurve returns 289 points (24h * 12 per hour + 1)", () => {
    const curve = getCurve(40.4, -3.7, 172, 1);
    expect(curve.length).toBe(289);
  });

  it("getWindow returns null when no synthesis possible", () => {
    const curve = getCurve(59.3, 18.1, 355, 1);
    const window = getWindow(curve, 50);
    expect(window).toBeNull();
  });

  /**
   * Built in UTC, because that is `dayOfYear`'s documented contract: it reads
   * whatever Date it is handed in UTC. The local-time constructor was the bug
   * here — `new Date(2026, 0, 1)` in Madrid is 2025-12-31T23:00Z, so the
   * assertion expected 1 and got 365, and this test failed on any developer's
   * machine east of Greenwich while passing in CI, which runs UTC. That is the
   * same local-vs-UTC confusion issue #25 fixed inside the module, reproduced
   * in the test that guards it.
   */
  it("dayOfYear returns correct value", () => {
    const jan1 = new Date(Date.UTC(2026, 0, 1));
    expect(dayOfYear(jan1)).toBe(1);
    const dec31 = new Date(Date.UTC(2026, 11, 31));
    expect(dayOfYear(dec31)).toBe(365);
  });
});

/**
 * `fmtDate` used to format every locale with a hardcoded Spanish array
 * (`["Ene","Feb",…]`), so the English site printed "27 Ago" and the Russian and
 * Lithuanian ones printed the wrong alphabet outright. It now takes the locale
 * and delegates the month name to `Intl`, the same way PR #61 fixed the
 * heatmap's month axis in this very file's sibling component.
 *
 * WHAT IS PINNED HERE, AND WHAT DELIBERATELY IS NOT.
 *
 * An earlier version of this file pinned six exact `Intl` outputs. It went
 * against a rule this repo already states, with the reason, in
 * lib/content-fingerprint.ts: strings from `Intl` come from the runtime's ICU
 * data, so depending on them "would make the fingerprint depend on the Node
 * build and fail in CI while passing locally". The mismatch is live — Node 24
 * locally against Node 22 in CI — and August happens to be stable across those
 * two CLDR versions, so the pin passed while being the wrong kind of assertion.
 *
 * So the month name is compared against `Intl` computed the same way rather
 * than transcribed, and what is asserted outright are the PROPERTIES that made
 * this a bug: not Spanish, right script, no trailing period.
 *
 * The one literal that IS pinned is Lithuanian, because it is ours and not
 * ICU's. Lithuanian CLDR returns "08" for an abbreviated month, so `Intl` alone
 * renders "27 08" — not a Lithuanian date and not a month name. This repo
 * settled that in lib/city-copy.ts (LT_MONTH_LABELS, with its own test) and
 * `shortMonthName` is now the single place both callers ask.
 */
describe("fmtDate localisation", () => {
  const aug27 = new Date(Date.UTC(2026, 7, 27));

  it.each(["es", "en", "fr", "de", "ru"])(
    "gives %s the month name its own ICU data has, not a transcription",
    (locale) => {
      const expected = new Intl.DateTimeFormat(locale, { month: "short" })
        .format(new Date(2026, 7, 15))
        .replace(/\.$/, "");
      expect(fmtDate(aug27, locale)).toBe(`27 ${expected}`);
    },
  );

  it("writes a Lithuanian month name, not the number ICU would give", () => {
    // `Intl` alone returns "08" here. "27 08" is not a date in Lithuanian, and
    // lib/city-copy.ts already carries the standard abbreviations for exactly
    // this reason — see LT_MONTH_LABELS and its test in city-copy.test.ts.
    expect(fmtDate(aug27, "lt")).toBe("27 rugp");
    expect(fmtDate(aug27, "lt")).not.toMatch(/\d\s+\d/);
  });

  it("never leaks the old Spanish abbreviation into another locale", () => {
    for (const locale of ["en", "fr", "de", "ru", "lt"]) {
      expect(fmtDate(aug27, locale)).not.toContain("Ago");
    }
  });

  it("writes Russian in Cyrillic and strips the trailing period", () => {
    const ru = fmtDate(aug27, "ru");
    expect(ru).toMatch(/\p{Script=Cyrillic}/u);
    expect(ru.endsWith(".")).toBe(false);
  });

  /**
   * Reads in UTC, matching the header on `fmtDate` and how `dateFromDoy` builds
   * its dates. 23:00Z on the 27th is the 28th in Madrid, so a local-time read
   * would print the wrong day for every European visitor after 22:00.
   */
  it("reads the date in UTC, not local time", () => {
    const lateOn27th = new Date(Date.UTC(2026, 7, 27, 23, 0, 0));
    expect(fmtDate(lateOn27th, "en")).toBe("27 Aug");
    expect(fmtDate(lateOn27th, "es")).toBe("27 ago");
  });
});
