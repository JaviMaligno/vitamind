/**
 * Convert a 2-letter country code to a flag emoji using regional indicator
 * symbols.
 *
 * The one copy. It used to live twice — in lib/cities-api.ts and in
 * lib/geonames.ts — and the two had already drifted: the cities-api one falls
 * back to the pin for a missing code, the geonames one threw on
 * `undefined.length`. Neither was reachable with a missing code today, but the
 * on-demand city pages add a third caller whose country code comes from a row
 * that a re-seed writes. This is the defensive version.
 *
 * No imports on purpose: it is reached from the client bundle, from server
 * components and from scripts run under `tsx` outside Next.
 */
export function ccToFlag(cc: string): string {
  if (!cc || cc.length !== 2) return "\u{1F4CD}";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => c.charCodeAt(0) + 0x1F1A5)
  );
}
