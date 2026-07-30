export const DAY_CURVE_META_KEY = "getvitamind/day-curve";

export type DayState = "good_now" | "upcoming" | "window_closed" | "no_synthesis";

const STATES: DayState[] = ["good_now", "upcoming", "window_closed", "no_synthesis"];

export interface DayCurveMeta {
  elevations: number[];
  stepMinutes: number;
  thresholdElevation: number;
  nowLocalHours: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  state: DayState;
  uvIndex: number;
  minutesNeeded: number | null;
  cloudCoverPercent: number | null;
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Reads the chart channel out of a tool result, or returns null.
 *
 * Everything is re-validated even though this server produced it: the widget is
 * a separate program that only ever sees whatever the host forwards, and a
 * half-populated payload should degrade to the empty state rather than throw
 * inside an iframe where nobody will read the console.
 */
export function readDayCurveMeta(result: unknown): DayCurveMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>)[DAY_CURVE_META_KEY];
  if (!raw || typeof raw !== "object") return null;

  const p = raw as Record<string, unknown>;
  const elevations = p.elevations;
  if (!Array.isArray(elevations) || elevations.length < 2 || elevations.length > 300) return null;
  if (!elevations.every((e) => typeof e === "number" && Number.isFinite(e))) return null;

  const threshold = num(p.thresholdElevation);
  if (threshold === null) return null;

  const state = STATES.includes(p.state as DayState) ? (p.state as DayState) : "no_synthesis";

  return {
    elevations: elevations as number[],
    stepMinutes: num(p.stepMinutes) ?? 15,
    thresholdElevation: threshold,
    nowLocalHours: num(p.nowLocalHours),
    windowStart: num(p.windowStart),
    windowEnd: num(p.windowEnd),
    state,
    uvIndex: num(p.uvIndex) ?? 0,
    minutesNeeded: num(p.minutesNeeded),
    cloudCoverPercent: num(p.cloudCoverPercent),
  };
}
