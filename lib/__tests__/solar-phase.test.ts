import { describe, it, expect } from "vitest";
import { solarPhase } from "../solar-phase";

describe("solarPhase", () => {
  it("noche cuando el sol está bien bajo el horizonte", () => {
    expect(solarPhase(-20, true)).toBe("night");
    expect(solarPhase(-20, false)).toBe("night");
  });
  it("día cuando el sol está alto", () => {
    expect(solarPhase(30, true)).toBe("day");
    expect(solarPhase(9, false)).toBe("day");
  });
  it("amanecer: sol bajo y subiendo", () => {
    expect(solarPhase(0, true)).toBe("dawn");
    expect(solarPhase(5, true)).toBe("dawn");
  });
  it("atardecer: sol bajo y bajando", () => {
    expect(solarPhase(0, false)).toBe("dusk");
    expect(solarPhase(5, false)).toBe("dusk");
  });
  it("umbral de noche en -6°", () => {
    expect(solarPhase(-6.1, true)).toBe("night");
    expect(solarPhase(-5.9, true)).toBe("dawn");
  });
});
