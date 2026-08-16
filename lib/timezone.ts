/**
 * Compute the UTC offset (in hours) for a given IANA timezone at a specific date.
 * Correctly handles DST transitions.
 */
export function tzOffsetForDate(timezone: string, date: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const match = tzPart.match(/GMT([+-]?\d+)?(?::(\d+))?/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? "0", 10);
    const minutes = parseInt(match[2] ?? "0", 10);
    return hours + (hours < 0 ? -minutes : minutes) / 60;
  } catch {
    return 0;
  }
}

/** A calendar date as read in some zone. `monthIndex` is 0-based, like `Date`. */
export interface ZonedDate {
  year: number;
  monthIndex: number;
  day: number;
}

/**
 * The calendar date an instant falls on IN A GIVEN ZONE — never the host's.
 *
 * "Today" is not one date: at 02:00 UTC it is already the 16th in Tokyo and
 * still the 15th in Los Angeles. A page about today in one of 40 cities has to
 * read the date where the city is, and the server that renders it (Vercel runs
 * UTC) is in neither place.
 *
 * `en-CA` is chosen for its ISO-shaped output (YYYY-MM-DD), which parses the
 * same way regardless of the runtime's own locale. With no IANA name we fall
 * back to a fixed offset, the same fallback `getSunTimes` uses when a City
 * record carries no zone.
 */
export function zonedDate(at: Date, timezone?: string, tzFallback = 0): ZonedDate {
  if (timezone) {
    try {
      const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .format(at)
        .split("-")
        .map(Number);
      return { year: y, monthIndex: m - 1, day: d };
    } catch {
      // Unknown zone name: fall through to the fixed-offset path rather than
      // throwing on a page render.
    }
  }
  const shifted = new Date(at.getTime() + tzFallback * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/**
 * Extract the hour (0-23) from an ISO-like time string "YYYY-MM-DDTHH:MM".
 * Timezone-independent — reads the hour literally from the string.
 */
export function hourFromTimeString(time: string): number {
  return parseInt(time.slice(11, 13), 10);
}
