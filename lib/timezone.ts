/**
 * Constructing an `Intl.DateTimeFormat` costs far more than using one, and the
 * offset is now probed once per sun event rather than once per day — seven
 * probes per `getSunTimes` call where there was one, on every day of every
 * table of every static page. Building one formatter per zone and reusing it
 * cut the 40-city × 12-month × 3-host-zone sweep in `sun-times-instant.test.ts`
 * from ~37 s to ~2 s.
 */
const OFFSET_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * Compute the UTC offset (in hours) for a given IANA timezone at a specific date.
 * Correctly handles DST transitions.
 *
 * The `date` is an INSTANT, and the answer is the offset in force at that
 * instant — not "the offset of that day", which on a transition day is not a
 * single number. Callers that want to place a wall-clock time must therefore
 * probe at the instant of the event they are placing; see `localHoursOf` in
 * `lib/sun-times.ts`.
 */
export function tzOffsetForDate(timezone: string, date: Date): number {
  try {
    let fmt = OFFSET_FORMATTERS.get(timezone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" });
      OFFSET_FORMATTERS.set(timezone, fmt);
    }
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

/**
 * The offset in force when a city's clock reads `localHours` on the UTC day that
 * starts at `utcMidnight` — the inverse of what `tzOffsetForDate` answers.
 *
 * `tzOffsetForDate` takes an instant; a wall clock is not one until an offset
 * has been applied, which is the offset we are asking for. So it is resolved in
 * two probes: read the zone at the instant the wall clock would name if it were
 * UTC, then re-read it at the instant that first answer implies. The second
 * probe is at most an hour from the true instant — the size of a DST step — so
 * it lands on the right side of every transition except within that hour.
 *
 * WITHIN THAT HOUR THE QUESTION HAS NO SINGLE ANSWER. Spring forward and 02:30
 * never happens; autumn back and it happens twice. What comes back then is one
 * of the two readings — which one depends on the side the first probe lands on,
 * so it is deterministic for a given zone and day but not a rule worth stating.
 * Both cases sit between local midnight and 03:00 wherever DST is observed, and
 * nothing this site publishes is a night figure: the sun times are placed the
 * other way round (instant to clock, `localHoursOf` in `lib/sun-times.ts`, where
 * no ambiguity exists) and the day curve only feeds UV, which is zero there.
 */
export function zoneOffsetAtLocalHour(timezone: string, utcMidnight: number, localHours: number): number {
  const guess = tzOffsetForDate(timezone, new Date(utcMidnight + localHours * 3_600_000));
  return tzOffsetForDate(timezone, new Date(utcMidnight + (localHours - guess) * 3_600_000));
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
