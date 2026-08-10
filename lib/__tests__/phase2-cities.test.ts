import { describe, it, expect } from "vitest";
import { isTreated, TREATED, CONTROL } from "@/lib/phase2-cities";
import { SUNRISE_CITIES } from "@/lib/sun-routes";

describe("phase 2 city assignment", () => {
  it("splits the sunrise cities in half", () => {
    expect(TREATED).toHaveLength(20);
    expect(CONTROL).toHaveLength(20);
  });

  it("covers every sunrise city exactly once", () => {
    const both = [...TREATED, ...CONTROL].sort();
    expect(new Set(both).size).toBe(both.length);
    expect(both).toEqual([...SUNRISE_CITIES].sort());
  });

  it("answers for known members of each group", () => {
    expect(isTreated("madrid")).toBe(true);
    expect(isTreated("valencia")).toBe(false);
  });

  it("treats an unknown city as control, so a typo cannot silently enrol it", () => {
    expect(isTreated("atlantis")).toBe(false);
  });
});
