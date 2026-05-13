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

  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);

  if (isIOSDevice && isSafari) return "ios-manual";

  // iOS Chrome/Firefox/Edge cannot install PWAs (iOS restricts install to Safari).
  if (isIOSDevice) return "unsupported";

  // Default: Android Chrome/Edge/Samsung/Opera, desktop Chrome/Edge before
  // beforeinstallprompt fires, Firefox desktop/Android, Safari macOS, etc.
  // All of these support installing via the browser menu.
  return "manual";
}

const SEEN_KEY = "vitamind:installBannerSeen";

export function getInstallBannerSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setInstallBannerSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch { /* storage full — silently ignore */ }
}
