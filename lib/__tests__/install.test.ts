import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isStandalone,
  getInstallBannerState,
  markInstallBannerShown,
  markInstallBannerOutcome,
  canShowInstallBanner,
  recordVisit,
  getVisitCount,
  INSTALL_BANNER_COOLDOWN_MS,
  INSTALL_BANNER_MAX_SHOWS,
} from "../install";

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

import { isInAppBrowser, detectPlatform, detectMobileOS } from "../install";

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

  it("returns 'manual' for Android Chrome without deferredPrompt (yet)", () => {
    setUA("Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
    expect(detectPlatform(null)).toBe("manual");
  });

  it("returns 'unsupported' for iOS Chrome (PWA install requires Safari)", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1");
    expect(detectPlatform(null)).toBe("unsupported");
  });

  it("falls back to 'manual' for unknown desktop UAs", () => {
    setUA("Mozilla/5.0 SomeRandomBrowser/1.0");
    expect(detectPlatform(null)).toBe("manual");
  });
});

describe("detectMobileOS", () => {
  function setUA(ua: string) {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  }

  it("returns 'ios' for an iPhone UA", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(detectMobileOS()).toBe("ios");
  });

  it("returns 'ios' for an iPhone inside the Instagram in-app browser", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 320.0.0.0.0");
    expect(detectMobileOS()).toBe("ios");
  });

  it("returns 'android' for an Android UA", () => {
    setUA("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
    expect(detectMobileOS()).toBe("android");
  });

  it("returns 'android' for an Android device inside the Instagram in-app browser", () => {
    setUA("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 Instagram 320.0.0.0.0");
    expect(detectMobileOS()).toBe("android");
  });

  it("returns 'other' for a desktop UA", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    expect(detectMobileOS()).toBe("other");
  });
});

describe("install banner state", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("starts as never shown", () => {
    expect(getInstallBannerState()).toEqual({ shownAt: 0, count: 0, outcome: "pending" });
    expect(canShowInstallBanner()).toBe(true);
  });

  it("records when the banner was actually shown, not when a timer started", () => {
    markInstallBannerShown(1_000);
    expect(getInstallBannerState()).toEqual({ shownAt: 1_000, count: 1, outcome: "pending" });
  });

  it("refuses a second ask before the cooldown", () => {
    markInstallBannerShown(1_000);
    expect(canShowInstallBanner(1_000 + INSTALL_BANNER_COOLDOWN_MS - 1)).toBe(false);
  });

  it("allows a second ask once the cooldown has passed — the old flag allowed none", () => {
    markInstallBannerShown(1_000);
    markInstallBannerOutcome("dismissed");
    expect(canShowInstallBanner(1_000 + INSTALL_BANNER_COOLDOWN_MS)).toBe(true);
  });

  it("stops after the maximum number of asks", () => {
    let t = 1_000;
    for (let i = 0; i < INSTALL_BANNER_MAX_SHOWS; i++) {
      markInstallBannerShown(t);
      t += INSTALL_BANNER_COOLDOWN_MS;
    }
    expect(canShowInstallBanner(t)).toBe(false);
  });

  it("never asks again once the app is installed", () => {
    markInstallBannerOutcome("installed");
    expect(canShowInstallBanner(Date.now() + 10 * INSTALL_BANNER_COOLDOWN_MS)).toBe(false);
  });

  it("keeps 'installed' terminal even if something shows the banner afterwards", () => {
    markInstallBannerOutcome("installed");
    markInstallBannerShown(5_000);
    expect(getInstallBannerState().outcome).toBe("installed");
    expect(canShowInstallBanner(5_000 + INSTALL_BANNER_COOLDOWN_MS)).toBe(false);
  });

  it("migrates the legacy boolean into one spent ask, not into silence forever", () => {
    localStorage.setItem("vitamind:installBannerSeen", "true");
    const state = getInstallBannerState();
    expect(state.count).toBe(1);
    expect(state.outcome).toBe("dismissed");
    // The legacy flag never recorded a time, so the cooldown starts now rather
    // than reading as already served.
    expect(canShowInstallBanner()).toBe(false);
    expect(canShowInstallBanner(state.shownAt + INSTALL_BANNER_COOLDOWN_MS)).toBe(true);
  });

  it("drops the legacy key once a real record exists", () => {
    localStorage.setItem("vitamind:installBannerSeen", "true");
    markInstallBannerShown(2_000);
    expect(localStorage.getItem("vitamind:installBannerSeen")).toBeNull();
  });

  it("survives JSON-incompatible stored values without throwing", () => {
    localStorage.setItem("vitamind:installBanner", "not-json");
    expect(() => getInstallBannerState()).not.toThrow();
    expect(getInstallBannerState().count).toBe(0);
  });
});

describe("visit counting", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("counts the first arrival", () => {
    expect(recordVisit()).toBe(1);
    expect(getVisitCount()).toBe(1);
  });

  it("counts one arrival per session, not per navigation", () => {
    recordVisit();
    recordVisit();
    recordVisit();
    expect(getVisitCount()).toBe(1);
  });

  it("counts the next session as a second visit", () => {
    recordVisit();
    sessionStorage.clear();
    expect(recordVisit()).toBe(2);
  });
});
