import { describe, it, expect, beforeEach, vi } from "vitest";
import { isStandalone } from "../install";

describe("isStandalone", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false in a non-standalone browser", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(isStandalone()).toBe(false);
  });

  it("returns true when display-mode is standalone", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(isStandalone()).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS)", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    Object.defineProperty(globalThis.navigator, "standalone", {
      value: true,
      configurable: true,
    });
    expect(isStandalone()).toBe(true);
    Object.defineProperty(globalThis.navigator, "standalone", {
      value: undefined,
      configurable: true,
    });
  });

  it("returns false when window is undefined (SSR)", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error simulating SSR
    delete globalThis.window;
    expect(isStandalone()).toBe(false);
    globalThis.window = origWindow;
  });
});
