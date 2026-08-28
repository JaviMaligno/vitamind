import { describe, it, expect } from "vitest";

import { BANDS, BAND_TYPES, type Band } from "@/lib/suntime-routes";
import {
  REFERENCE,
  SEASON_MONTHS,
  bandFigures,
  allBandFigures,
  impossibleMonths,
  monthlyMinutes,
} from "@/lib/suntime-content";

/**
 * The figures these pages print, and the three claims the pages are built on.
 *
 * Every number on the four pages is an assertion about `lib/`. CLAUDE.md
 * tabulates five claims that shipped to production stale and lived there for
 * weeks because nobody re-derived them — so the numbers are computed at build
 * from `minutesForVitD`, never written into `messages/*.json`, and this file is
 * what keeps the derivation honest.
 */

const ALL_TYPES = [1, 2, 3, 4, 5, 6] as const;

describe("the reference the pages quote", () => {
  it("is the one the spec declares, and declares all of it", () => {
    // Spec §9: every assumption is stated on the page. A hidden assumption is
    // what makes somebody else's number look authoritative, which is the exact
    // defect these pages exist to correct.
    expect(REFERENCE.lat).toBe(40);
    expect(REFERENCE.areaFraction).toBe(0.25);
    expect(REFERENCE.age).toBe(35);
    expect(REFERENCE.targetIU).toBe(1000);
  });

  it("quotes March to September as the season", () => {
    expect(SEASON_MONTHS).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("the three bands, in order", () => {
  it("gives every band a range", () => {
    const figures = allBandFigures();
    for (const band of BANDS) {
      expect(figures[band].band).toBe(band);
      expect(figures[band].types).toEqual(BAND_TYPES[band]);
      expect(Number.isFinite(figures[band].minMinutes)).toBe(true);
      expect(Number.isFinite(figures[band].maxMinutes)).toBe(true);
    }
  });

  it("orders fair < medium < dark, at both ends of the range", () => {
    // The whole reason there are three pages and not one: the consensus answer
    // ("10 to 15 minutes") is right for the middle band and wrong for the other
    // two. If this ordering ever collapses, the pages stop being three answers.
    const f = allBandFigures();
    expect(f.fair.minMinutes).toBeLessThan(f.medium.minMinutes);
    expect(f.medium.minMinutes).toBeLessThan(f.dark.minMinutes);
    expect(f.fair.maxMinutes).toBeLessThan(f.medium.maxMinutes);
    expect(f.medium.maxMinutes).toBeLessThan(f.dark.maxMinutes);
  });

  it("keeps min below max inside each band", () => {
    for (const band of BANDS) {
      const f = bandFigures(band);
      expect(f.minMinutes).toBeLessThan(f.maxMinutes);
    }
  });

  it("lands in minutes, not hours or seconds", () => {
    // A unit slip is the failure this catches: the spec measured 5.0 min for
    // type I and 30.0 for type VI at the summer peak, so the whole season
    // across all six types cannot plausibly leave 1..240.
    for (const band of BANDS) {
      const f = bandFigures(band);
      expect(f.minMinutes).toBeGreaterThan(1);
      expect(f.maxMinutes).toBeLessThan(240);
    }
  });

  it("covers the six types between the three bands, with no gap at the seams", () => {
    // fair's slowest type (II) must still be quicker than medium's fastest
    // (III), or the bands would overlap and "fair / medium / dark" would stop
    // being a partition the reader can place themselves in.
    const f = allBandFigures();
    expect(f.fair.maxMinutes).toBeLessThan(f.medium.maxMinutes);
    expect(BANDS.flatMap((b) => [BAND_TYPES[b][0], BAND_TYPES[b][1]])).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});

describe("the safety margin is identical across bands — why there are three pages and not six", () => {
  /**
   * Spec §3, and the finding that overturned the first draft. In `lib/vitd.ts`
   * the characteristic time is `tau = 0.8·MED/uvi` and `erythemaMinutes` is
   * `MED/uvi`, so MED — the only term the skin type enters through — cancels.
   * Everything derived is the same number scaled by {1, 1.25, 1.5, 2.25, 3.75, 6}.
   *
   * That is what makes six pages thin content: they would be one page with a
   * scaled number. If this test ever fails, the premise of the whole spec has
   * moved and the page count has to be reconsidered — not the assertion.
   */
  it("is the same ratio in all three bands, to six decimals", () => {
    const ratios = BANDS.map((b) => bandFigures(b).safetyRatio);
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 6);
  });

  it("survives changes to area, target, age and latitude", () => {
    const variants = [
      { areaFraction: 0.1 },
      { areaFraction: 0.5 },
      { targetIU: 600 },
      { targetIU: 2000 },
      { age: 20 },
      { age: 70 },
      { lat: 25 },
      { lat: 55 },
    ];
    for (const v of variants) {
      const ratios = BANDS.map((b) => bandFigures(b, { ...REFERENCE, ...v }).safetyRatio);
      for (const r of ratios) {
        expect(r, `ratio diverged for ${JSON.stringify(v)}`).toBeCloseTo(ratios[0], 6);
      }
    }
  });

  it("leaves real headroom — the number is a fraction of the burn time", () => {
    // Not a tautology: it is the claim the fair-skin page is written around
    // (5 minutes of vitamin D against 21 to burn). A ratio at or above 1 would
    // mean the recommended exposure reaches erythema, and no page should print
    // that.
    for (const band of BANDS) {
      const f = bandFigures(band);
      expect(f.safetyRatio).toBeGreaterThan(0);
      expect(f.safetyRatio).toBeLessThan(1);
      expect(f.burnMinutesAtMin).toBeGreaterThan(f.minMinutes);
      expect(f.burnMinutesAtMax).toBeGreaterThan(f.maxMinutes);
    }
  });
});

describe("winter is impossible, and it is impossible for everyone", () => {
  /**
   * The other half of why three and not six: the window depends on
   * `MIN_UVI = 3`, which has no skin-type term at all. "Here you cannot
   * synthesize in winter" would be the identical sentence on all six pages.
   */
  it("returns the same impossible months whichever band asks", () => {
    const atHighLatitude = { ...REFERENCE, lat: 55 };
    const perBand = BANDS.map((b) => monthlyMinutes(b, atHighLatitude));
    const impossibleFor = (rows: { month: number; minMinutes: number | null }[]) =>
      rows.filter((r) => r.minMinutes === null).map((r) => r.month);

    const first = impossibleFor(perBand[0]);
    expect(first.length).toBeGreaterThan(0);
    for (const rows of perBand) expect(impossibleFor(rows)).toEqual(first);
  });

  it("agrees with the band-independent helper", () => {
    const opts = { ...REFERENCE, lat: 55 };
    const fromHelper = impossibleMonths(opts);
    const fromBand = monthlyMinutes("fair", opts)
      .filter((r) => r.minMinutes === null)
      .map((r) => r.month);
    expect(fromHelper).toEqual(fromBand);
  });

  it("finds no impossible month in the tropics and some at high latitude", () => {
    expect(impossibleMonths({ ...REFERENCE, lat: 5 })).toEqual([]);
    expect(impossibleMonths({ ...REFERENCE, lat: 60 }).length).toBeGreaterThan(2);
  });
});

describe("the month-by-month table", () => {
  it("returns all twelve months in order", () => {
    const rows = monthlyMinutes("medium");
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("pairs a null minimum with a null maximum, never one of each", () => {
    // An impossible month has no answer at any duration. Half a null would
    // print "impossible, 34 min" on the page.
    for (const band of BANDS) {
      for (const row of monthlyMinutes(band, { ...REFERENCE, lat: 55 })) {
        expect(row.minMinutes === null).toBe(row.maxMinutes === null);
      }
    }
  });

  it("is quickest around the June solstice at northern latitudes", () => {
    const rows = monthlyMinutes("medium");
    const possible = rows.filter((r) => r.minMinutes !== null);
    const quickest = possible.reduce((a, b) => (b.minMinutes! < a.minMinutes! ? b : a));
    expect([6, 7]).toContain(quickest.month);
  });
});

describe("the six individual types stay available as in-page detail", () => {
  /**
   * Spec §3: six in the control, three in the content. The per-type figures are
   * printed inside each page as a gloss, so they have to exist — and they have
   * to bracket the band range rather than contradict it.
   */
  it("gives each band's range as the envelope of its own types", () => {
    for (const band of BANDS) {
      const f = bandFigures(band);
      const [from, to] = BAND_TYPES[band];
      const own = f.byType.filter((t) => t.type >= from && t.type <= to);
      expect(own).toHaveLength(2);
      expect(Math.min(...own.map((t) => t.minMinutes!))).toBeCloseTo(f.minMinutes, 6);
      expect(Math.max(...own.map((t) => t.maxMinutes!))).toBeCloseTo(f.maxMinutes, 6);
    }
  });

  it("scales the six types by the MED ratios and nothing else", () => {
    // {1, 1.25, 1.5, 2.25, 3.75, 6} — the same number six times, which is the
    // measured fact behind the page count.
    const byType = new Map(
      BANDS.flatMap((b: Band) => bandFigures(b).byType).map((t) => [t.type, t.minMinutes!]),
    );
    const base = byType.get(1)!;
    const expected: Record<number, number> = { 1: 1, 2: 1.25, 3: 1.5, 4: 2.25, 5: 3.75, 6: 6 };
    for (const type of ALL_TYPES) {
      expect(byType.get(type)! / base, `type ${type}`).toBeCloseTo(expected[type], 3);
    }
  });
});
