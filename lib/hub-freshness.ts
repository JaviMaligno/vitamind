import { BUILTIN_CITIES } from "./cities";
import { DOY_REFERENCE_YEAR } from "./solar";
import { SUNRISE_CITIES, sunCityUrl } from "./sun-routes";
import { cityToday, type TodayInZone } from "./sun-today";
import type { City } from "./types";

/**
 * Reading a hub's own HTML to find out WHICH DAY it was rendered for.
 *
 * `lib/sun-today.ts` argues that the served hub HTML is at most a day old, and
 * the only thing making that true is the cron at `/api/revalidate-today`. Until
 * this module existed, nothing could check the claim: `revalidatePath` returns
 * `void`, so a cron whose invalidation had silently stopped working answered
 * 200 with `{revalidated: 240}` exactly like a healthy one. This repo has
 * already paid for that shape of silence twice — the VAPID pair (53 days) and
 * the Supabase trio (58 days), both documented in CLAUDE.md, both discovered by
 * a human noticing an absence rather than by a failing check.
 *
 * What makes the check possible is the one dated string the hub deliberately
 * publishes: the JSON-LD `Event` nodes carry `startDate`, and their calendar day
 * is the day the HTML was rendered for. See defence #4 in `lib/sun-today.ts` —
 * that Event is the single intentional exception to "no server-rendered string
 * names a calendar date", and its whole justification is that it makes a hub's
 * freshness machine-readable. This module is the machine that reads it.
 *
 * It parses the JSON-LD rather than grepping for a date, because a grep over
 * page HTML would also match a date in prose, a build id, or a nearby-city link,
 * and would then report "fresh" for a page whose structured data had been
 * dropped entirely.
 */

/** One hub to probe: a locale, an unlocalised city slug, and where to fetch it. */
export interface HubSample {
  locale: string;
  base: string;
  city: City;
  url: string;
}

/**
 * The hubs the cron actually fetches — three, not 240.
 *
 * Reads are the binding meter on this plan (the read budget is the number of
 * crawled URLs), so the probe samples the MECHANISM rather than auditing every
 * page. Three fetches a day is noise; 240 would be a second crawler.
 *
 * The three are not interchangeable. `sunEvent` in `lib/schema.ts` drops both
 * Events on the two days a year when the offset that placed the wall clock is
 * not the offset in force at the instant it designates — a DST transition — so a
 * sample made only of European cities would carry no dated Event at all on two
 * days a year and the probe would go blind on exactly those days. Asia/Tokyo has
 * never observed DST, so `tokio` always carries the signal; `madrid` and
 * `sidney` transition on different dates in opposite hemispheres, so no single
 * day can silence more than one of the three. Two locales, so a fault confined
 * to the prefixed routes is visible too.
 */
export const HUB_FRESHNESS_SAMPLE: readonly { locale: string; base: string }[] = [
  { locale: "es", base: "madrid" },
  { locale: "en", base: "tokio" },
  { locale: "es", base: "sidney" },
];

export function hubSamples(): HubSample[] {
  return HUB_FRESHNESS_SAMPLE.map(({ locale, base }) => {
    // A sample naming a city that has left SUNRISE_CITIES would fetch a 404 and
    // be read as "the cron is broken". Fail here instead, where the message says
    // what is actually wrong.
    if (!SUNRISE_CITIES.includes(base)) {
      throw new Error(`hub freshness sample "${base}" is not in SUNRISE_CITIES`);
    }
    const city = BUILTIN_CITIES.find((c) => c.id === `builtin:${base}`);
    if (!city) throw new Error(`hub freshness sample "${base}" has no builtin city record`);
    return { locale, base, city, url: sunCityUrl(locale, base) };
  });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The calendar day a hub rendered for that day would stamp on its Events, or
 * null when it would emit none.
 *
 * `SunTodayPage` emits the Events only while the city's own year equals
 * `DOY_REFERENCE_YEAR`, because every solar figure on this site is computed for
 * that year and publishing a 2026 instant to a reader in 2027 would be a
 * fabricated timestamp. So the stamp is `DOY_REFERENCE_YEAR` and the guard is
 * the year comparison, not a formatting choice.
 */
function stampedDate(day: TodayInZone): string | null {
  if (day.year !== DOY_REFERENCE_YEAR) return null;
  return `${DOY_REFERENCE_YEAR}-${pad2(day.monthIndex + 1)}-${pad2(day.day)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Event dates a HEALTHY hub may be serving, in the city's own zone.
 *
 * Two days are allowed, and the second one is not slack — it is the only value
 * that makes the verdict independent of a cache behaviour this repo has not
 * pinned down. If on-demand invalidation purges the entry, the probe's own fetch
 * regenerates the page and reads TODAY. If it instead marks the entry stale and
 * regenerates behind the request, the same fetch is served the previous
 * generation and reads YESTERDAY. Both are the mechanism working. Anything
 * older is not: a frozen hub drifts one day further out every day, so a broken
 * invalidation is caught on the second run at the latest.
 *
 * Empty means the signal cannot exist today at all — see `stampedDate`.
 */
export function allowedHubDates(city: City, at: Date = new Date()): string[] {
  const today = stampedDate(cityToday(city, at));
  const yesterday = stampedDate(cityToday(city, new Date(at.getTime() - DAY_MS)));
  return [yesterday, today].filter((d): d is string => d !== null);
}

const LD_JSON = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

/**
 * Every calendar day named by an `Event.startDate` in a page's JSON-LD.
 *
 * Deliberately tolerant of unparseable or unexpected JSON: a block that does not
 * parse contributes no date, which lands the caller on "no-signal" — reported,
 * never mistaken for freshness.
 */
export function eventDatesFromHtml(html: string): string[] {
  const dates = new Set<string>();
  for (const [, body] of html.matchAll(LD_JSON)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    const graph = (parsed as { "@graph"?: unknown })?.["@graph"];
    if (!Array.isArray(graph)) continue;
    for (const node of graph) {
      const n = node as { "@type"?: unknown; startDate?: unknown };
      if (n?.["@type"] !== "Event" || typeof n.startDate !== "string") continue;
      const day = n.startDate.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) dates.add(day);
    }
  }
  return [...dates].sort();
}

/**
 * - `fresh` — a dated Event for today or yesterday in the city's zone.
 * - `stale` — dated Events, none of them recent: the invalidation is not landing.
 * - `no-signal` — no dated Event at all. Either the year has outrun
 *   `DOY_REFERENCE_YEAR`, or it is this city's DST transition day, or the Event
 *   nodes have been removed from the page. The first and third are real
 *   problems; none of them is evidence of freshness, so a run where EVERY sample
 *   is `no-signal` fails too.
 * - `unreachable` — the fetch itself failed.
 */
export type HubVerdict = "fresh" | "stale" | "no-signal" | "unreachable";

export interface HubProbe {
  locale: string;
  base: string;
  url: string;
  verdict: HubVerdict;
  /** The Event days found in the HTML, for the log line. */
  dates: string[];
  /** What would have counted as fresh, for the log line. */
  allowed: string[];
  status?: number;
  error?: string;
}

export function classifyHub(
  sample: HubSample,
  html: string,
  at: Date = new Date(),
  status?: number,
): HubProbe {
  const dates = eventDatesFromHtml(html);
  const allowed = allowedHubDates(sample.city, at);
  const verdict: HubVerdict =
    dates.length === 0 ? "no-signal"
    : dates.some((d) => allowed.includes(d)) ? "fresh"
    : "stale";
  return { locale: sample.locale, base: sample.base, url: sample.url, verdict, dates, allowed, status };
}

/**
 * Did the run prove anything?
 *
 * One stale sample condemns the run: the pages it stands for are serving a day's
 * figures that is not today's or yesterday's, which is precisely the claim
 * `lib/sun-today.ts` says cannot happen. And a run with no `fresh` sample at all
 * proves nothing either way, so it is not allowed to report success — a probe
 * that can only ever pass is the silent 200 this whole module exists to remove.
 *
 * What this does NOT establish: that the other 237 hubs are fresh. The sample
 * tests that `revalidatePath` still invalidates and that regeneration still
 * produces today's figures. Under a request-driven regeneration model the
 * sampled three are also the only hubs the probe itself guarantees to refresh.
 */
export function hubFreshnessOk(probes: readonly HubProbe[]): boolean {
  return (
    probes.length > 0 &&
    !probes.some((p) => p.verdict === "stale") &&
    probes.some((p) => p.verdict === "fresh")
  );
}
