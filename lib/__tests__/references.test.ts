import { describe, it, expect } from "vitest";
import { REFERENCES, referencesFor, type ReferenceId } from "@/lib/references";

describe("REFERENCES", () => {
  it("holds every citation that used to live in the message files", () => {
    expect(Object.keys(REFERENCES)).toHaveLength(51);
  });

  it("gives each one a label and a resolvable-looking url", () => {
    // NOAA's calculator and the NIH fact sheets are living resources, not papers:
    // they have no publication year to cite. Every other entry must carry one, or
    // the label is not a citation.
    const undated: readonly ReferenceId[] = ["noaaSolarCalculator", "nihMagnesium", "nihVitaminD"];
    for (const [id, ref] of Object.entries(REFERENCES)) {
      const label = undated.includes(id as ReferenceId) ? /\S/ : /\(\d{4}\)/; // "Holick MF (1982) — ..."
      expect(ref.label, id).toMatch(label);
      expect(ref.url, id).toMatch(/^https:\/\//);
    }
  });

  it("has no duplicate urls, so the same paper is not cited under two ids", () => {
    const urls = Object.values(REFERENCES).map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("returns the citations for a learn question in order", () => {
    const got = referencesFor("block4.q1");
    expect(got.length).toBeGreaterThan(0);
    expect(got[0]).toHaveProperty("label");
    expect(got[0]).toHaveProperty("url");
  });

  it("returns an empty list for a question that has no citations", () => {
    // block4's q7 (golden hour) and q9 (midnight sun) are astronomy, not claims
    // needing a paper. Questions are keyed by block: block1.q7 does cite.
    expect(referencesFor("block4.q7")).toEqual([]);
    expect(referencesFor("block4.q9")).toEqual([]);
  });

  /**
   * `referencesFor` fails silently: an unrecognised key returns [] rather than
   * throwing. The learn page derives that key at runtime from its own `qKey`
   * scheme, so a change on either side — renaming the blocks, dropping the
   * prefix — would empty 21 of the 27 cited questions with the suite still
   * green. This is the test that would notice.
   */
  it("answers for every question the learn page will ask about", () => {
    const BLOCK_SIZES = { block1: 9, block2: 5, block3: 6, block4: 9 } as const;
    const cited: string[] = [];
    for (const [block, count] of Object.entries(BLOCK_SIZES)) {
      for (let i = 1; i <= count; i++) {
        if (referencesFor(`${block}.q${i}`).length > 0) cited.push(`${block}.q${i}`);
      }
    }
    // 27 questions carried citations before the move; that number is the contract.
    expect(cited).toHaveLength(27);
    // And every block must contribute — a prefix bug would empty three of four.
    for (const block of Object.keys(BLOCK_SIZES)) {
      expect(cited.filter((k) => k.startsWith(block)).length, block).toBeGreaterThan(0);
    }
  });

  it("accounts for all 80 citation slots the message files used to hold", () => {
    const BLOCK_SIZES = { block1: 9, block2: 5, block3: 6, block4: 9 } as const;
    let slots = 0;
    for (const [block, count] of Object.entries(BLOCK_SIZES)) {
      for (let i = 1; i <= count; i++) slots += referencesFor(`${block}.q${i}`).length;
    }
    expect(slots).toBe(80);
  });
});
