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

import { isInAppBrowser, detectPlatform } from "../install";

describe("isInAppBrowser", () => {
  function setUA(ua: string) {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  }

  it("returns true for Instagram webview", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.0");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns true for Facebook webview (FBAN)", () => {
    setUA("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0.0.0.0]");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns true for TikTok webview", () => {
    setUA("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 musical_ly_29.0.0 trill_2023");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns false for plain iOS Safari", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(isInAppBrowser()).toBe(false);
  });

  it("returns false for desktop Chrome", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    expect(isInAppBrowser()).toBe(false);
  });
});

describe("detectPlatform", () => {
  function setUA(ua: string) {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  }

  it("returns 'native' when deferredPrompt is provided", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0");
    expect(detectPlatform({} as Event)).toBe("native");
  });

  it("returns 'ios-manual' for iOS Safari without deferredPrompt", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(detectPlatform(null)).toBe("ios-manual");
  });

  it("returns 'manual' for Firefox desktop without deferredPrompt", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0");
    expect(detectPlatform(null)).toBe("manual");
  });

  it("returns 'manual' for Safari macOS without deferredPrompt", () => {
    setUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15");
    expect(detectPlatform(null)).toBe("manual");
  });

  it("returns 'unsupported' when iOS UA is inside an in-app browser", () => {
    setUA("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Instagram 320.0.0.0.0");
    expect(detectPlatform(null)).toBe("unsupported");
  });

  it("returns 'unsupported' for unknown UAs without deferredPrompt", () => {
    setUA("Mozilla/5.0 SomeRandomBrowser/1.0");
    expect(detectPlatform(null)).toBe("unsupported");
  });
});
