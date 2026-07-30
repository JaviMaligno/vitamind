export const HISTORY_META_KEY = "getvitamind/history";

export interface HistoryDay {
  /** YYYY-MM-DD. */
  date: string;
  /** The sun was strong enough that day. */
  viableSun: boolean;
  /** The user confirmed they went outside. */
  wentOutside: boolean;
}

export interface HistoryMeta {
  /** False when the client connected without an account: the widget says so. */
  authenticated: boolean;
  days: HistoryDay[];
  streak: number;
  daysTracked: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readDay(raw: unknown): HistoryDay | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== "string" || !DATE_RE.test(r.date)) return null;
  return {
    date: r.date,
    viableSun: r.viableSun === true,
    wentOutside: r.wentOutside === true,
  };
}

export function readHistoryMeta(result: unknown): HistoryMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>)[HISTORY_META_KEY];
  if (!raw || typeof raw !== "object") return null;

  const p = raw as Record<string, unknown>;
  const days = Array.isArray(p.days)
    ? p.days.slice(0, 366).map(readDay).filter((d): d is HistoryDay => d !== null)
    : [];

  return {
    authenticated: p.authenticated === true,
    days,
    streak: typeof p.streak === "number" ? p.streak : 0,
    daysTracked: typeof p.daysTracked === "number" ? p.daysTracked : days.length,
  };
}

/**
 * Marks a day confirmed in the local copy, so the calendar reacts to the tap
 * before the server has answered.
 *
 * One-way on purpose: `log_sun_session` confirms a day and has no un-confirm.
 * Letting the widget toggle would invent a capability the tool does not have,
 * and the first thing the next refresh would do is contradict it.
 */
export function withDayConfirmed(days: HistoryDay[], date: string): HistoryDay[] {
  const known = days.some((d) => d.date === date);
  if (!known) return [...days, { date, viableSun: false, wentOutside: true }];
  return days.map((d) => (d.date === date ? { ...d, wentOutside: true } : d));
}
