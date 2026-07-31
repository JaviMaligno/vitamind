export const DAY_CURVE_META_KEY = "getvitamind/day-curve";

export type DayState = "good_now" | "upcoming" | "window_closed" | "no_synthesis";
export type Intensity = "optimal" | "moderate" | null;

/**
 * The five verdicts the app's own dashboard distinguishes — `good_now` splits by
 * intensity, because "this is as good as it gets" and "usable, but not ideal" are
 * different advice and the user acts on them differently.
 */
export type StatusKey = "optimal" | "moderate" | "upcoming" | "windowClosed" | "insufficient";

const STATES: DayState[] = ["good_now", "upcoming", "window_closed", "no_synthesis"];

export interface DayMeta {
  state: DayState;
  intensity: Intensity;
  uvIndex: number;
  minutesNeeded: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  minutesUntilWindow: number | null;
  windowClosesInMinutes: number | null;
  bestHour: number | null;
  bestMinutes: number | null;
  cloudCoverPercent: number | null;
  cloudDegraded: boolean;
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Mirrors `getStatusKey` in components/dashboard/day-status.ts. */
export function statusKey(meta: Pick<DayMeta, "state" | "intensity">): StatusKey {
  if (meta.state === "good_now") return meta.intensity === "optimal" ? "optimal" : "moderate";
  if (meta.state === "upcoming") return "upcoming";
  if (meta.state === "window_closed") return "windowClosed";
  return "insufficient";
}

export function readDayMeta(result: unknown): DayMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>)[DAY_CURVE_META_KEY];
  if (!raw || typeof raw !== "object") return null;

  const p = raw as Record<string, unknown>;
  const uv = num(p.uvIndex);
  if (uv === null) return null;

  return {
    state: STATES.includes(p.state as DayState) ? (p.state as DayState) : "no_synthesis",
    intensity: p.intensity === "optimal" || p.intensity === "moderate" ? p.intensity : null,
    uvIndex: uv,
    minutesNeeded: num(p.minutesNeeded),
    windowStart: num(p.windowStart),
    windowEnd: num(p.windowEnd),
    minutesUntilWindow: num(p.minutesUntilWindow),
    windowClosesInMinutes: num(p.windowClosesInMinutes),
    bestHour: num(p.bestHour),
    bestMinutes: num(p.bestMinutes),
    cloudCoverPercent: num(p.cloudCoverPercent),
    cloudDegraded: p.cloudDegraded === true,
  };
}

/** `formatCountdown` from components/dashboard/day-status.ts, same output. */
export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes < 1) return "<1 min";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** `fmtMin` from components/dashboard/day-status.ts, same output. */
export function fmtMin(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `~${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}
