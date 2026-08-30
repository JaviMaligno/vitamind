import { track } from "@vercel/analytics";

/**
 * Product instrumentation.
 *
 * The app deliberately works with no account (docs/ROADMAP.md, phase 8), so
 * "signups" is not a usable health metric — it measures a thing the product
 * tells people they do not need. What this module counts instead are the two
 * actions that actually create a recurring relationship without an account
 * (enabling push, installing the PWA) plus the return visit that proves the
 * app was worth coming back to.
 *
 * Everything here is best-effort: a tracking call must never throw into a
 * render path, and must never block a user action.
 */

const VISIT_KEY = "vitamind:visit";

/** Property values Vercel Web Analytics accepts on a custom event. */
type EventProps = Record<string, string | number | boolean | null>;

export interface VisitRecord {
  /** ISO calendar date (YYYY-MM-DD) of the first visit we ever saw. */
  firstSeen: string;
  /** ISO calendar date of the most recent visit. */
  lastSeen: string;
  /** Number of DISTINCT days this browser has opened the app. */
  days: number;
}

export type VisitKind = "first" | "same_day" | "returning";

export interface VisitClassification {
  record: VisitRecord;
  kind: VisitKind;
  /** True when this is the first hit of a calendar day — the retention tick. */
  isNewDay: boolean;
  daysSinceFirst: number;
}

/** Local calendar date as YYYY-MM-DD. Local, not UTC: "did they come back on a
 *  different day" is a question about the user's day, not Greenwich's. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidRecord(v: unknown): v is VisitRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<VisitRecord>;
  return (
    typeof r.firstSeen === "string" && DATE_RE.test(r.firstSeen) &&
    typeof r.lastSeen === "string" && DATE_RE.test(r.lastSeen) &&
    typeof r.days === "number" && Number.isFinite(r.days) && r.days >= 1
  );
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Decide what kind of visit `today` is, given whatever was stored before.
 *
 * Pure — the caller owns reading and writing storage. A stored record that is
 * missing, malformed or from an older shape is treated as "no record": a
 * corrupted analytics blob must not be able to break the app.
 */
export function classifyVisit(today: string, prev: VisitRecord | null): VisitClassification {
  if (!isValidRecord(prev)) {
    return {
      record: { firstSeen: today, lastSeen: today, days: 1 },
      kind: "first",
      isNewDay: true,
      daysSinceFirst: 0,
    };
  }

  // Clamp at zero: clocks go backwards (timezone travel, a corrected system
  // clock), and a negative age would poison every cohort chart downstream.
  const daysSinceFirst = Math.max(0, daysBetween(prev.firstSeen, today));
  const isNewDay = daysBetween(prev.lastSeen, today) > 0;

  if (!isNewDay) {
    return { record: prev, kind: "same_day", isNewDay: false, daysSinceFirst };
  }

  return {
    record: { firstSeen: prev.firstSeen, lastSeen: today, days: prev.days + 1 },
    kind: "returning",
    isNewDay: true,
    daysSinceFirst,
  };
}

function readVisit(): VisitRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    return raw ? (JSON.parse(raw) as VisitRecord) : null;
  } catch {
    return null;
  }
}

function writeVisit(record: VisitRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VISIT_KEY, JSON.stringify(record));
  } catch { /* storage full or blocked — analytics is never worth an exception */ }
}

/** Fire a custom event. Never throws; a no-op on the server. */
export function emit(name: string, props?: EventProps): void {
  if (typeof window === "undefined") return;
  try {
    track(name, props);
  } catch { /* blocked by an ad blocker, offline, quota — all fine */ }
}

/**
 * Record that the app was opened. Emits at most one `visit` event per page load,
 * carrying whether this browser is new or returning and how many distinct days
 * it has used the app. Safe to call on every mount.
 */
export function trackVisit(now: Date = new Date()): VisitClassification {
  const result = classifyVisit(todayKey(now), readVisit());
  writeVisit(result.record);
  emit("visit", {
    kind: result.kind,
    days: result.record.days,
    days_since_first: result.daysSinceFirst,
    standalone:
      typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)").matches === true,
  });
  return result;
}

/** The user picked a location, and how. First real act of intent on the page.
 *  `method` is "gps" or the city's `source` (builtin / geonames / nominatim / custom),
 *  which separates "tapped a preset" from "searched for their own place". */
export function trackCitySelected(method: string): void {
  emit("city_selected", { method });
}

/** The user personalised the calculation (skin type, age, exposure, target). */
export function trackPrefsChanged(field: "skin" | "area" | "age" | "target"): void {
  emit("prefs_changed", { field });
}

/** Push notifications — the strongest recurring-relationship signal that needs no account. */
export function trackPush(
  outcome: "enabled" | "disabled" | "denied" | "failed" | "gated",
  platform: string,
): void {
  emit(`push_${outcome}`, { platform });
}

/** PWA install — the other no-account conversion. */
export function trackInstall(
  outcome: "accepted" | "dismissed" | "manual" | "installed",
  platform: string,
): void {
  emit(`install_${outcome}`, { platform });
}

/** The install banner was put in front of someone. Without this the install
 *  events have no denominator and a low install count is unreadable: it could
 *  be a bad offer or an offer nobody ever saw. */
export function trackInstallBannerShown(platform: string): void {
  emit("install_banner_shown", { platform });
}

/** GPS refused. Friction on the shortest path to a first answer. */
export function trackGpsDenied(): void {
  emit("gps_denied");
}

/**
 * Account funnel. The product tells people they need no account, so the
 * question is not "how do we push signups" but "how many people want one
 * anyway, and where do they fall out" — form opened → submitted → succeeded.
 */
export function trackAuth(
  step: "form_opened" | "signup" | "login" | "logout" | "reset_requested",
  props?: EventProps,
): void {
  emit(`auth_${step}`, props);
}

/**
 * Account-VALUE proxies.
 *
 * An account is only worth building for if people are accumulating something
 * they would hate to lose — that is the whole case, and it is currently
 * unmeasured. Each of these is a user act that creates data an account would
 * preserve across devices: a curated favourite, a saved place they could not
 * find in the built-in list, a hand-corrected day of history.
 *
 * Read together with `visit` (days) these answer the real question: is there a
 * population with enough invested that syncing it is a feature rather than a
 * chore? Until that shows up in the numbers, building the account is a guess.
 */
export function trackInvestment(
  kind: "favorite_added" | "favorite_removed" | "custom_location_saved" | "history_override",
  props?: EventProps,
): void {
  emit(kind, props);
}
