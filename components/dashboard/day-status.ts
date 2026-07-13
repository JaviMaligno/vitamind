import type { NowStatus } from "@/lib/types";

/** Pure formatting/derivation helpers for the "My Day" status, shared by the
 *  hero so the display logic lives in one place (no i18n here — callers own copy). */

export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes < 1) return "<1 min";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function fmtMin(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `~${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

export type StatusKey = "optimal" | "moderate" | "upcoming" | "windowClosed" | "insufficient";

export function getStatusKey(ns: NowStatus): StatusKey {
  if (ns.state === "good_now") return ns.intensity === "optimal" ? "optimal" : "moderate";
  if (ns.state === "upcoming") return "upcoming";
  if (ns.state === "window_closed") return "windowClosed";
  return "insufficient";
}
