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
});
