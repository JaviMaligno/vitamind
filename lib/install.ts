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
