export type InstallPlatform = "native" | "ios-manual" | "manual" | "unsupported";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari pre-PWA spec
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /Instagram/i.test(ua) ||
    /FBAN|FBAV/i.test(ua) ||
    /musical_ly|TikTok/i.test(ua)
  );
}

export function detectPlatform(deferredPrompt: Event | null): InstallPlatform {
  if (deferredPrompt) return "native";
  if (typeof navigator === "undefined") return "unsupported";

  const ua = navigator.userAgent || "";

  if (isInAppBrowser()) return "unsupported";

  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS/.test(ua);

  if (isIOS && isSafari) return "ios-manual";

  const isFirefox = /Firefox/.test(ua) && !/Seamonkey/.test(ua);
  const isMacSafari = /Macintosh/.test(ua) && isSafari;

  if (isFirefox || isMacSafari) return "manual";

  return "unsupported";
}
