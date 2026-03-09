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

  it("dayOfYear returns correct value", () => {
    const jan1 = new Date(2026, 0, 1);
    expect(dayOfYear(jan1)).toBe(1);
    const dec31 = new Date(2026, 11, 31);
    expect(dayOfYear(dec31)).toBe(365);
  });
});
