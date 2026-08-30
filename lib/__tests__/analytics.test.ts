import { describe, it, expect } from "vitest";
import { classifyVisit, type VisitRecord } from "../analytics";

describe("classifyVisit", () => {
  it("treats a visitor with no stored record as first-ever", () => {
    const r = classifyVisit("2026-08-30", null);
    expect(r.kind).toBe("first");
    expect(r.isNewDay).toBe(true);
    expect(r.daysSinceFirst).toBe(0);
    expect(r.record).toEqual({ firstSeen: "2026-08-30", lastSeen: "2026-08-30", days: 1 });
  });

  it("does not count a second visit on the same day as a return", () => {
    const prev: VisitRecord = { firstSeen: "2026-08-30", lastSeen: "2026-08-30", days: 1 };
    const r = classifyVisit("2026-08-30", prev);
    expect(r.kind).toBe("same_day");
    expect(r.isNewDay).toBe(false);
    expect(r.record.days).toBe(1);
    expect(r.daysSinceFirst).toBe(0);
  });

  it("counts a visit on a later day as a return and increments the day count", () => {
    const prev: VisitRecord = { firstSeen: "2026-08-30", lastSeen: "2026-08-30", days: 1 };
    const r = classifyVisit("2026-08-31", prev);
    expect(r.kind).toBe("returning");
    expect(r.isNewDay).toBe(true);
    expect(r.record).toEqual({ firstSeen: "2026-08-30", lastSeen: "2026-08-31", days: 2 });
    expect(r.daysSinceFirst).toBe(1);
  });

  it("spans month boundaries when counting days since the first visit", () => {
    const prev: VisitRecord = { firstSeen: "2026-08-30", lastSeen: "2026-08-31", days: 2 };
    const r = classifyVisit("2026-09-02", prev);
    expect(r.daysSinceFirst).toBe(3);
    expect(r.record.days).toBe(3);
  });

  // A stored record is user-controlled data that survives deploys. A shape from an
  // older build (or hand-edited storage) must never throw inside a tracking call —
  // analytics failing has to be invisible, never a broken page.
  it.each([
    ["missing fields", { firstSeen: "2026-08-30" }],
    ["wrong types", { firstSeen: 7, lastSeen: null, days: "many" }],
    ["unparseable dates", { firstSeen: "not-a-date", lastSeen: "not-a-date", days: 3 }],
  ])("falls back to a fresh record when the stored one has %s", (_label, stored) => {
    const r = classifyVisit("2026-08-30", stored as unknown as VisitRecord);
    expect(r.kind).toBe("first");
    expect(r.record).toEqual({ firstSeen: "2026-08-30", lastSeen: "2026-08-30", days: 1 });
  });

  // Clocks move backwards: timezone travel, a corrected system clock, DST edges.
  it("never lets a backwards clock produce a negative age or lose the day count", () => {
    const prev: VisitRecord = { firstSeen: "2026-08-30", lastSeen: "2026-08-31", days: 2 };
    const r = classifyVisit("2026-08-29", prev);
    expect(r.daysSinceFirst).toBe(0);
    expect(r.record.days).toBe(2);
    expect(r.isNewDay).toBe(false);
  });
});
