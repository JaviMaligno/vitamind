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

export type MobileOS = "ios" | "android" | "other";

/**
 * Detects the underlying mobile OS regardless of which browser (or in-app
 * webview) is running. Used to tailor "open in your real browser" guidance:
 * iOS users need Safari, Android users need Chrome.
 */
export function detectMobileOS(): MobileOS {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
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

/**
 * WHEN WE ARE ALLOWED TO ASK FOR AN INSTALL.
 *
 * This used to be a single boolean, `vitamind:installBannerSeen`, set to "true"
 * and never read again for anything but "shut up forever". `InstallBanner` set
 * it from a 10-second `setTimeout`, so the ONE install request a browser would
 * ever get was spent ten seconds after landing — typically on a sunrise table
 * arrived at from Google, before the product had demonstrated anything, and the
 * flag then suppressed the ask for the rest of that browser's life whether or
 * not the banner had even been looked at.
 *
 * So the flag is now a record: WHEN we last asked, HOW MANY times, and HOW it
 * ended. That is the minimum needed to answer the two questions the boolean
 * could not: "may we ask again later?" and "did the ask work?".
 *
 * The gate itself (`canShowInstallBanner`) is deliberately conservative — two
 * asks, a week apart, and never again once the app is installed. The point of
 * this change is not to ask MORE; it is to spend the ask on someone who has
 * come back or done something, rather than on a stopwatch.
 */

const SEEN_KEY = "vitamind:installBannerSeen";
const STATE_KEY = "vitamind:installBanner";
const VISITS_KEY = "vitamind:visits";
/** Session-scoped so a visit is one arrival, not one client-side navigation. */
const VISIT_COUNTED_KEY = "vitamind:visitCounted";

/**
 * `pending` — shown, no verdict yet (closed the tab, navigated away).
 * `dismissed` — the user closed it. Earns one more ask after the cooldown.
 * `installed` — the app is on the home screen. Never ask again.
 */
export type InstallBannerOutcome = "pending" | "dismissed" | "installed";

export interface InstallBannerState {
  /** Epoch ms of the last time the banner was actually put on screen. */
  shownAt: number;
  /** How many times it has been put on screen. */
  count: number;
  outcome: InstallBannerOutcome;
}

/** Two asks in the life of a browser, and the second one only after a week. */
export const INSTALL_BANNER_MAX_SHOWS = 2;
export const INSTALL_BANNER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const NEVER_SHOWN: InstallBannerState = { shownAt: 0, count: 0, outcome: "pending" };

function readState(): InstallBannerState {
  if (typeof window === "undefined") return NEVER_SHOWN;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<InstallBannerState> | null;
      if (parsed && typeof parsed === "object") {
        return {
          shownAt: typeof parsed.shownAt === "number" ? parsed.shownAt : 0,
          count: typeof parsed.count === "number" ? parsed.count : 0,
          outcome: parsed.outcome === "dismissed" || parsed.outcome === "installed"
            ? parsed.outcome
            : "pending",
        };
      }
    }
    // Legacy boolean. Those browsers were asked once — by the stopwatch — so
    // they are migrated as "asked once, dismissed", which under the rules below
    // earns them exactly one properly-timed second ask. `shownAt` is unknown
    // (the boolean never recorded it) and 0 would make the cooldown look
    // already served, so the migration is dated at read time.
    if (localStorage.getItem(SEEN_KEY) === "true") {
      // PERSISTED, and that is load-bearing rather than tidy. Returning this
      // without writing it re-derives `shownAt` on EVERY read, so
      // `now - state.shownAt` is always ~0 and the cooldown below can never
      // elapse: a browser carrying the legacy flag would never be asked again.
      // Which is the exact failure the test above this function is named for —
      // "not into silence forever" — and it only passed because three calls
      // could land in one millisecond. It failed a production deploy on
      // 2026-08-28 when they did not.
      const migrated: InstallBannerState = { shownAt: Date.now(), count: 1, outcome: "dismissed" };
      writeState(migrated);
      return migrated;
    }
  } catch { /* private mode / storage disabled — behave as never shown */ }
  return NEVER_SHOWN;
}

function writeState(state: InstallBannerState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    // The legacy key is dropped once the record exists, so the migration above
    // can only ever run once per browser.
    localStorage.removeItem(SEEN_KEY);
  } catch { /* storage full — silently ignore */ }
}

export function getInstallBannerState(): InstallBannerState {
  return readState();
}

/**
 * Records a REAL display. Call it when the banner (or the instructions modal,
 * or the install toast — anything that spends the ask) reaches the screen, not
 * when a timer starts. That distinction is the whole bug this replaces.
 */
export function markInstallBannerShown(now: number = Date.now()): void {
  const prev = readState();
  writeState({
    shownAt: now,
    count: prev.count + 1,
    // A new display resets the verdict; `installed` is terminal and stays.
    outcome: prev.outcome === "installed" ? "installed" : "pending",
  });
}

export function markInstallBannerOutcome(outcome: InstallBannerOutcome): void {
  const prev = readState();
  writeState({ ...prev, outcome });
}

export function canShowInstallBanner(now: number = Date.now()): boolean {
  const state = readState();
  if (state.outcome === "installed") return false;
  if (state.count === 0) return true;
  if (state.count >= INSTALL_BANNER_MAX_SHOWS) return false;
  return now - state.shownAt >= INSTALL_BANNER_COOLDOWN_MS;
}

/**
 * Arrivals, not navigations. Counted once per browser session (sessionStorage),
 * so the twelve month pages a reader clicks through in one sitting are one
 * visit — otherwise "second visit" would mean "second click" and we would be
 * back to asking a stranger.
 */
export function recordVisit(): number {
  if (typeof window === "undefined") return 0;
  try {
    if (sessionStorage.getItem(VISIT_COUNTED_KEY) === "true") return getVisitCount();
    const next = getVisitCount() + 1;
    localStorage.setItem(VISITS_KEY, String(next));
    sessionStorage.setItem(VISIT_COUNTED_KEY, "true");
    return next;
  } catch {
    return 0;
  }
}

export function getVisitCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number.parseInt(localStorage.getItem(VISITS_KEY) ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * "This person is using the thing, not just reading it."
 *
 * A DOM event rather than a store write, because the banner has to react while
 * it is mounted and there is no cross-component state worth persisting: the
 * signal is about THIS session. Emitters are the controls that only someone
 * engaging with the product touches — the skin selector, a month expander, the
 * GPS button.
 */
export const INSTALL_INTENT_EVENT = "vitamind:install-intent";

export function signalInstallIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(INSTALL_INTENT_EVENT));
  } catch { /* no CustomEvent (very old browser) — the visit signal still works */ }
}
