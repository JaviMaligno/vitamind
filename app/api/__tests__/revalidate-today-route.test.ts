import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { GET } from "@/app/api/revalidate-today/route";
import { SUNRISE_CITIES } from "@/lib/sun-routes";
import { routing } from "@/i18n/routing";
import { hubSamples } from "@/lib/hub-freshness";
import { cityToday } from "@/lib/sun-today";
import { DOY_REFERENCE_YEAR } from "@/lib/solar";
import type { City } from "@/lib/types";

const URL_BASE = "http://localhost/api/revalidate-today";
const request = (auth?: string) =>
  new NextRequest(URL_BASE, { headers: auth ? { authorization: auth } : undefined });

const realFetch = global.fetch;

/**
 * A fixed instant inside `DOY_REFERENCE_YEAR`.
 *
 * The route's verdict compares the Events' calendar day against today's in the
 * CITY's zone, and the day is stamped with `DOY_REFERENCE_YEAR` — so once the
 * wall-clock year passes 2026 a test that used the real clock would start
 * reporting the fresh fixture as stale for a reason that has nothing to do with
 * the route. Only `Date` is faked: `AbortSignal.timeout` inside the route still
 * runs on real timers.
 */
const NOW = new Date("2026-08-16T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The day a hub rendered at `at` would stamp on its Events, derived here from
 * `cityToday` (which `lib/__tests__/sun-today.test.ts` pins against Tokyo and
 * Los Angeles) rather than from the freshness module the route uses — so the
 * fixture and the code under test do not agree by construction.
 */
const stamp = (city: City, at: Date) => {
  const day = cityToday(city, at);
  return `${DOY_REFERENCE_YEAR}-${pad2(day.monthIndex + 1)}-${pad2(day.day)}`;
};

/** A hub page as it is actually served: the graph inside one ld+json script. */
function hubHtml(date: string | null): string {
  const events = date
    ? [
        { "@type": "Event", "@id": `#sunrise-${date}`, startDate: `${date}T06:12:00+02:00` },
        { "@type": "Event", "@id": `#sunset-${date}`, startDate: `${date}T20:47:00+02:00` },
      ]
    : [];
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Place", "@id": "https://getvitamind.app/#place-madrid" },
      ...events,
      { "@type": "FAQPage", mainEntity: [] },
    ],
  };
  return [
    "<!doctype html><html><body><h1>Hub</h1>",
    `<script type="application/ld+json">${JSON.stringify(graph)}</script>`,
    "</body></html>",
  ].join("");
}

/**
 * Serves every sampled hub the given HTML, chosen per city so each one carries
 * a date in its own zone. `null` means "no dated Event at all".
 */
function serveHubs(htmlFor: (city: City) => string | { html?: string; status: number }) {
  const byUrl = new Map(hubSamples().map((s) => [s.url, s.city]));
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const city = byUrl.get(url);
    if (!city) throw new Error(`unexpected fetch: ${url}`);
    const out = htmlFor(city);
    if (typeof out === "string") return new Response(out, { status: 200 });
    return new Response(out.html ?? "", { status: out.status });
  }) as unknown as typeof fetch;
}

const freshHubs = () => serveHubs((city) => hubHtml(stamp(city, NOW)));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("CRON_SECRET", "test-secret");
  freshHubs();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  global.fetch = realFetch;
});

describe("GET /api/revalidate-today", () => {
  it("refuses a request with no bearer token", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses a wrong bearer token", async () => {
    const res = await GET(request("Bearer nope"));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails loudly when CRON_SECRET is not configured, rather than running unauthenticated", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates one path per hub page: every sunrise city in every locale", async () => {
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    const expected = SUNRISE_CITIES.length * routing.locales.length;
    expect(revalidatePath).toHaveBeenCalledTimes(expected);
    const body = await res.json();
    expect(body.revalidated).toBe(expected);
  });

  it("revalidates the localized path, not the route template", async () => {
    // The point of the cron is to refresh the pages a reader actually fetches.
    // Passing the `[locale]/[cityPrefix]/[city]` template would also sweep the
    // 438 vitamin D city pages that share the segment, which do not need it.
    await GET(request("Bearer test-secret"));
    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    expect(paths).toContain("/amanecer/madrid");
    expect(paths).toContain("/en/sunrise/london");
    expect(paths.some((p) => p.includes("["))).toBe(false);
  });

  it("does not touch the month pages, which carry no day-dependent claim", async () => {
    await GET(request("Bearer test-secret"));
    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    expect(paths.some((p) => /\/(agosto|august)$/.test(p))).toBe(false);
  });
});

/**
 * The half of the run that can fail.
 *
 * `revalidatePath` returns `void`, so counting the paths it was handed proves
 * nothing: the route used to answer `{revalidated: 240}` whether or not a single
 * page was invalidated. What it answers now has to be earned by fetching a few
 * hubs back and reading the day their JSON-LD Events name — the only dated
 * server-rendered surface these pages have (defence #4 in lib/sun-today.ts).
 */
describe("the freshness check the run's success rests on", () => {
  const run = async () => {
    const res = await GET(request("Bearer test-secret"));
    return { res, body: await res.json() };
  };

  it("reports success when the sampled hubs carry today's date", async () => {
    const { res, body } = await run();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.probes.map((p: { verdict: string }) => p.verdict)).toEqual(["fresh", "fresh", "fresh"]);
  });

  it("fetches only the fixed sample, because reads are the binding meter", async () => {
    // 240 hubs are revalidated; three are read back. A probe that fetched every
    // hub would double this site's own crawl budget for no extra information.
    await run();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const urls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(hubSamples().map((s) => s.url));
    expect(new Set(urls).size).toBe(3);
  });

  it("accepts yesterday's date, which is what a stale-while-revalidate cache serves", async () => {
    // Whether the probe's own fetch is served the regenerated page or the
    // previous one is a cache behaviour this repo has not pinned down, and the
    // check must not depend on which. One day older is the mechanism working;
    // two is not.
    serveHubs((city) => hubHtml(stamp(city, new Date(NOW.getTime() - DAY_MS))));
    const { res, body } = await run();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("does NOT report success when a sampled hub comes back stale", async () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * DAY_MS);
    serveHubs((city) =>
      city.id === "builtin:tokio" ? hubHtml(stamp(city, fiveDaysAgo)) : hubHtml(stamp(city, NOW)),
    );
    const { res, body } = await run();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    const tokyo = body.probes.find((p: { base: string }) => p.base === "tokio");
    expect(tokyo.verdict).toBe("stale");
    expect(tokyo.dates).toEqual([`${DOY_REFERENCE_YEAR}-08-11`]);
    // One stale sample condemns the run even though the other two are fresh:
    // the sample stands for 240 pages, and a page serving a five-day-old window
    // is the exact failure lib/sun-today.ts claims cannot happen.
    expect(body.probes.filter((p: { verdict: string }) => p.verdict === "fresh")).toHaveLength(2);
  });

  it("still revalidates every hub when the check fails", async () => {
    // The invalidation is the job; the check is the evidence. Losing the
    // evidence must not also skip the job.
    serveHubs((city) => hubHtml(stamp(city, new Date(NOW.getTime() - 5 * DAY_MS))));
    const { res, body } = await run();
    expect(res.status).toBe(500);
    expect(revalidatePath).toHaveBeenCalledTimes(SUNRISE_CITIES.length * routing.locales.length);
    expect(body.revalidated).toBe(SUNRISE_CITIES.length * routing.locales.length);
  });

  it("does not report success when no sampled hub carries a dated Event at all", async () => {
    // What this looks like in production: `DOY_REFERENCE_YEAR` has fallen behind
    // the calendar, so `todayEventDays` returns nothing and every hub loses its
    // Event nodes. The freshness signal is gone, so the run can prove nothing —
    // and a check that passes when it cannot see is the silent 200 all of this
    // exists to remove.
    serveHubs(() => hubHtml(null));
    const { res, body } = await run();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.probes.map((p: { verdict: string }) => p.verdict)).toEqual([
      "no-signal", "no-signal", "no-signal",
    ]);
  });

  it("does not report success when every probe fetch fails", async () => {
    serveHubs(() => ({ status: 503 }));
    const { res, body } = await run();
    expect(res.status).toBe(500);
    expect(body.probes.every((p: { verdict: string }) => p.verdict === "unreachable")).toBe(true);
    expect(body.probes.every((p: { status: number }) => p.status === 503)).toBe(true);
  });

  it("tolerates one unreachable hub as long as another proves freshness", async () => {
    // Deliberate: a single 5xx or timeout is a blip, and a cron that goes red on
    // one is a cron whose red light stops being read.
    serveHubs((city) =>
      city.id === "builtin:sidney" ? { status: 500 } : hubHtml(stamp(city, NOW)),
    );
    const { res, body } = await run();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
