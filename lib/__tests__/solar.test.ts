import { describe, it, expect } from "vitest";
import { solarElev, vitDHrs, dayOfYear, getCurve, getWindow } from "../solar";

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
