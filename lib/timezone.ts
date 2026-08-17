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

/**
 * Extract the hour (0-23) from an ISO-like time string "YYYY-MM-DDTHH:MM".
 * Timezone-independent — reads the hour literally from the string.
 */
export function hourFromTimeString(time: string): number {
  return parseInt(time.slice(11, 13), 10);
}
