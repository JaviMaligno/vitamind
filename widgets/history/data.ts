export const HISTORY_META_KEY = "getvitamind/history";

/**
 * The user's answer for a day. Three values, matching the app's own calendar and
 * the `userOverride` column behind it: they went out, they had sun and stayed
 * in, or they never said. A missing answer is not a "no".
 */
export type DayAnswer = true | false | null;

export interface HistoryDay {
  /** YYYY-MM-DD. */
  date: string;
  /** The sun was strong enough that day. */
  viableSun: boolean;
  /** What the user answered, if anything. */
  wentOutside: DayAnswer;
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
    // Only the two real answers survive; anything else is "never said", which is
    // what an absent or malformed value actually means.
    wentOutside: r.wentOutside === true ? true : r.wentOutside === false ? false : null,
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
 * Sets a day's confirmation in the local copy, so the calendar reacts to the tap
 * before the server has answered.
 *
 * Both directions, mirroring the app's own calendar: tapping a confirmed day
 * clears it. The tool writes null rather than false when clearing, since false
 * would mean "the user says they did NOT go out" — a different claim.
 */
export function withDayConfirmed(days: HistoryDay[], date: string, answer: DayAnswer = true): HistoryDay[] {
  const known = days.some((d) => d.date === date);
  if (!known) return answer === true ? [...days, { date, viableSun: false, wentOutside: true }] : days;
  return days.map((d) => (d.date === date ? { ...d, wentOutside: answer } : d));
}

/**
 * What the next tap sets: unanswered → went out → stayed in → unanswered.
 *
 * The same cycle the app's calendar runs, so a day tapped in the chat and a day
 * tapped in the app pass through the same states in the same order.
 */
export function nextAnswer(current: DayAnswer): DayAnswer {
  return current === true ? false : current === false ? null : true;
}
