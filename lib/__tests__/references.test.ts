import { describe, it, expect } from "vitest";
import { REFERENCES, referencesFor, type ReferenceId } from "@/lib/references";
import es from "@/messages/es.json";

describe("REFERENCES", () => {
  it("holds every citation that used to live in the message files", () => {
    expect(Object.keys(REFERENCES)).toHaveLength(18);
  });

  it("gives each one a label and a resolvable-looking url", () => {
    // NOAA's solar calculator is a tool, not a paper: it has no publication year
    // to cite. Every other entry must carry one, or the label is not a citation.
    const undated: readonly ReferenceId[] = ["noaaSolarCalculator"];
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
    const got = referencesFor("q1");
    expect(got.length).toBeGreaterThan(0);
    expect(got[0]).toHaveProperty("label");
    expect(got[0]).toHaveProperty("url");
  });

  it("returns an empty list for a question that has no citations", () => {
    // q7 (golden hour) and q9 (midnight sun) are astronomy, not claims needing a paper.
    expect(referencesFor("q7")).toEqual([]);
    expect(referencesFor("q9")).toEqual([]);
  });

  /**
   * The migration guard: while the message files still carry `sources`, the module
   * must agree with them exactly. Delete this test in task 2, when the arrays go.
   */
  it("matches what es.json still says, label for label", () => {
    const fromMessages: { label: string; url: string }[] = [];
    for (const v of Object.values(es.learn.block4 as Record<string, { sources?: { label: string; url: string }[] }>)) {
      if (v?.sources) fromMessages.push(...v.sources);
    }
    const fromModule = Object.values(REFERENCES).map((r) => ({ label: r.label, url: r.url }));
    expect(fromModule).toEqual(expect.arrayContaining(fromMessages));
    expect(fromMessages).toHaveLength(fromModule.length);
  });
});
