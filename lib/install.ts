export type InstallPlatform = "native" | "ios-manual" | "manual" | "unsupported";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari pre-PWA spec
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}
