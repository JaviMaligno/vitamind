import { zonedDate } from "@/lib/timezone";

/**
 * WHEN a subscriber gets the daily push, decided on the subscriber's clock.
 *
 * The endpoint used to be one cron at 08:00 UTC that iterated every stored
 * subscription. 08:00 UTC is a wall-clock time for nobody but the server: the
 * "go out in the sun" notice landed at 10:00 in Madrid, 04:00 in New York, 01:00
 * in Los Angeles and 17:00 in Tokyo — before dawn on one side of the world and
 * after sunset on the other. The message names a synthesis window for *today*,
 * so arriving after it has closed is not a late notification, it is a wrong one.
 *
 * The endpoint is now invoked once every UTC hour and each run sends only to the
 * subscriptions whose LOCAL time is inside the morning window below.
 */

/** First local hour (inclusive) at which the daily push may be sent. */
export const NOTIFY_LOCAL_HOUR_START = 9;

/**
 * First local hour (exclusive) at which it may no longer be sent.
 *
 * Three hours wide, and that width is load-bearing rather than a taste call.
 * Vercel's Hobby plan invokes a cron AT ANY POINT INSIDE ITS HOUR (documented as
 * ±59 min), so the 24 daily entries wired in `vercel.json` are guaranteed to
 * fire once per UTC hour but not to be punctual: two consecutive runs can be
 * anywhere from a minute to 1 h 59 m apart. A window of two hours or less could
 * be stepped clean over, and the subscriber would silently get nothing that day.
 * Three hours cannot be. `lib/__tests__/push-schedule.test.ts` sweeps the
 * worst-case jitter patterns over nine zones to hold that.
 *
 * The window sits in the morning because the notification is an invitation to go
 * out *before* the day's synthesis window, which is centred on solar noon
 * everywhere. Under the old single cron a Madrid subscriber got it at 10:00 in
 * summer and 09:00 in winter — one local hour was never preserved, so 09:00–12:00
 * keeps the same part of the day rather than any particular past minute.
 */
export const NOTIFY_LOCAL_HOUR_END = 12;

/**
 * Building an `Intl.DateTimeFormat` costs far more than using one, and this is
 * asked once per subscription on every one of the 24 daily runs.
 */
const HOUR_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function hourFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = HOUR_FORMATTERS.get(timezone);
  if (cached) return cached;
  // Throws RangeError on an unknown zone, before anything is cached.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  HOUR_FORMATTERS.set(timezone, fmt);
  return fmt;
}

/**
 * The hour (0–23) a clock reads in `timezone` at the instant `at`.
 *
 * `tzFallback` is the integer offset stored on the subscription and is used ONLY
 * when there is no IANA zone name. It must not be preferred: it is captured once,
 * when the user subscribes, so a Madrid subscription created in winter carries
 * `1` for the rest of its life and is an hour wrong from late March to late
 * October — the same class of fault the sun tables carried until `localHoursOf`
 * started probing the zone at the instant of each event.
 */
export function zonedHour(at: Date, timezone?: string, tzFallback = 0): number {
  if (timezone) {
    try {
      const part = hourFormatter(timezone)
        .formatToParts(at)
        .find((p) => p.type === "hour");
      if (part) return parseInt(part.value, 10);
    } catch {
      // Unknown zone name: fall through to the fixed-offset path rather than
      // dropping the subscriber out of the run.
    }
  }
  return new Date(at.getTime() + tzFallback * 3_600_000).getUTCHours();
}

/**
 * The subscriber's own calendar day, `YYYY-MM-DD`, at the instant `at`.
 *
 * This is the key the once-a-day guard is written against, and it has to be the
 * LOCAL day: at 23:30 UTC it is already tomorrow in Madrid and still today in
 * Los Angeles, so a UTC day would let one subscriber be picked twice and another
 * not at all.
 */
export function localDayKey(at: Date, timezone?: string, tzFallback = 0): string {
  const { year, monthIndex, day } = zonedDate(at, timezone, tzFallback);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The scheduling fields of a stored subscription. */
export interface NotifySchedulable {
  /** IANA zone name, when the subscription has one. */
  timezone?: string;
  /** Integer UTC offset captured at subscribe time. Fallback only. */
  tz: number;
  /** The subscriber's local day on which the last push was claimed. */
  lastNotifiedOn?: string;
}

export interface NotifyDecision {
  due: boolean;
  localHour: number;
  localDay: string;
  reason: "due" | "outside-window" | "already-notified";
}

/**
 * Whether this run should act on this subscription, and the local day the
 * decision belongs to.
 *
 * The day is returned even when `due` is false so a caller can log why a run
 * touched nobody without recomputing it.
 */
export function notifyDecision(at: Date, sub: NotifySchedulable): NotifyDecision {
  const localHour = zonedHour(at, sub.timezone, sub.tz);
  const localDay = localDayKey(at, sub.timezone, sub.tz);

  if (localHour < NOTIFY_LOCAL_HOUR_START || localHour >= NOTIFY_LOCAL_HOUR_END) {
    return { due: false, localHour, localDay, reason: "outside-window" };
  }
  if (sub.lastNotifiedOn === localDay) {
    return { due: false, localHour, localDay, reason: "already-notified" };
  }
  return { due: true, localHour, localDay, reason: "due" };
}
