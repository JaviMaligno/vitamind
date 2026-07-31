export const FORECAST_META_KEY = "getvitamind/forecast";

export interface ForecastDay {
  date: string;
  peakUVIndex: number;
  avgCloudPercent: number;
  windowStart: string | null;
  windowEnd: string | null;
  minutesNeeded: number | null;
  synthesisPossible: boolean;
}

export interface ForecastMeta {
  days: ForecastDay[];
  /** The day worth picking, decided on the server so nobody re-derives it. */
  bestDay: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length <= 8 ? v : null);

function readDay(raw: unknown): ForecastDay | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.date !== "string" || !DATE_RE.test(d.date)) return null;
  const w = d.window && typeof d.window === "object" ? (d.window as Record<string, unknown>) : null;
  return {
    date: d.date,
    peakUVIndex: num(d.peakUVIndex) ?? 0,
    avgCloudPercent: num(d.avgCloudPercent) ?? 0,
    windowStart: w ? str(w.start) : null,
    windowEnd: w ? str(w.end) : null,
    minutesNeeded: num(d.minutesNeededAtBestHour),
    synthesisPossible: d.synthesisPossible === true,
  };
}

export function readForecastMeta(result: unknown): ForecastMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>)[FORECAST_META_KEY];
  if (!raw || typeof raw !== "object") return null;

  const p = raw as Record<string, unknown>;
  const days = Array.isArray(p.days)
    ? p.days.slice(0, 7).map(readDay).filter((d): d is ForecastDay => d !== null)
    : [];
  if (days.length === 0) return null;

  return {
    days,
    bestDay: typeof p.bestDay === "string" && DATE_RE.test(p.bestDay) ? p.bestDay : null,
  };
}

/**
 * The sky in one glyph, same thresholds as `weatherIcon` in
 * components/dashboard/ForecastRow.tsx so a day does not look sunny in the chat
 * and overcast in the app.
 */
export function skyIcon(avgCloudPercent: number, peakUVIndex: number): string {
  if (peakUVIndex < 1) return "☁️";
  if (avgCloudPercent > 70) return "🌥️";
  if (avgCloudPercent > 30) return "⛅";
  return "☀️";
}

/** Weekday index (Mon = 0) straight off the string, read in UTC. */
export function weekdayIndex(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day + 6) % 7;
}

/** Day of month, without going through a local Date. */
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}
