import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { SUNRISE_CITIES, sunCityUrl } from "@/lib/sun-routes";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import {
  allowedHubDates, classifyHub, hubFreshnessOk, hubSamples, type HubProbe,
} from "@/lib/hub-freshness";

/**
 * Refreshes the today hubs on a schedule, because ISR alone cannot keep them true.
 *
 * ISR regenerates on request: when `revalidate` has elapsed, the NEXT reader is
 * served the stale copy while regeneration happens behind them. A page nobody
 * fetches is never regenerated, so a crawler that visits monthly always reads
 * what its own previous visit generated — a month old. For 240 new low-traffic
 * URLs that is the normal case, not the edge case.
 *
 * That matters here and not on the month pages because the hub's subject is
 * today. Over weeks the synthesis window drifts by the full seasonal amplitude
 * and can invert outright: Oslo has a midday window in August and none in
 * September. Stale HTML would then assert that skin synthesises vitamin D at
 * hours when it does not.
 *
 * Pushing the regeneration from a cron bounds the age of the served HTML at one
 * day. At one day the window moves by at most an hour and the regime cannot
 * flip, so the figure is at worst slightly early or late, never false. The
 * browser still corrects it on mount for anyone running JavaScript; this is what
 * protects the readers who do not, which includes the machines we want to be
 * quoted by.
 *
 * AND THE RUN HAS TO BE FALSIFIABLE, because `revalidatePath` returns `void`.
 *
 * The first version of this route ended with a bare loop over 240 paths and then
 * answered `{revalidated: 240}` unconditionally — a number computed from the
 * length of an array, not from anything that happened. Every failure mode of the
 * mechanism (a rename that makes the paths miss, an invalidation that no longer
 * lands, a render that stops producing today's figures) came back as a green
 * cron invocation. CLAUDE.md records what that costs here: the VAPID pair stayed
 * corrupted 53 days and the Supabase trio 58, both because the failing path
 * answered 200. So after revalidating, the route FETCHES a small fixed sample of
 * hubs and checks that the day their JSON-LD Events name is today's or
 * yesterday's, and returns 500 when it is not, which Vercel's cron dashboard
 * shows as a failed invocation.
 *
 * Three fetches, not 240: reads are the binding meter on this plan. The sample
 * proves the mechanism, not the freshness of all 240 pages — `lib/hub-freshness.ts`
 * states exactly what it does and does not establish, and why those three cities.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One concrete localized path per hub, never a route template. This used to
  // matter because the template `[locale]/[cityPrefix]/[city]` would also have
  // swept the 438 vitamin D city pages sharing that segment; the hubs now have
  // their own six static folders, so that particular collision is gone, but the
  // concrete paths stay. A template invalidates a whole route regardless of
  // which pages under it changed, and this cron's only job is the day-dependent
  // ones — the vitamin D pages are `revalidate = false` precisely so that
  // nothing rewrites bytes that cannot have changed.
  const paths = routing.locales.flatMap((locale) =>
    SUNRISE_CITIES.map((base) => sunCityUrl(locale, base).slice(SITE_URL.length)),
  );

  for (const path of paths) revalidatePath(path);

  // Probed AFTER the invalidation, and in this order for two reasons: the
  // revalidation must happen even if every probe fetch fails, and under a
  // request-driven regeneration model these three fetches are themselves the
  // requests that rebuild the sampled hubs.
  const probes = await probeSample();
  const ok = hubFreshnessOk(probes);
  const summary = { revalidated: paths.length, ok, probes };

  if (!ok) {
    console.error("[api/revalidate-today] freshness check failed:", JSON.stringify(summary));
    // 500 so the cron invocation is marked failed. The body still reports what
    // was revalidated: the invalidation did run, it is the evidence that it
    // worked that is missing.
    return NextResponse.json(summary, { status: 500 });
  }

  console.log("[api/revalidate-today] run finished:", JSON.stringify(summary));
  return NextResponse.json(summary);
}

/** Long enough for a cold regeneration of one hub, short enough that three in
 * parallel cannot push the invocation into a platform timeout. */
const PROBE_TIMEOUT_MS = 6000;

async function probeSample(): Promise<HubProbe[]> {
  const at = new Date();
  return Promise.all(
    hubSamples().map(async (sample): Promise<HubProbe> => {
      // Reported even when the fetch fails: a log line saying which days would
      // have counted is what makes the failure diagnosable a week later.
      const allowed = allowedHubDates(sample.city, at);
      try {
        // `cache: "no-store"` keeps Next's own fetch cache out of it. There is
        // deliberately no `?cb=` cache-buster: query strings are not part of the
        // Vercel cache key for these routes, so it would buy nothing and only
        // make the probe fetch a URL no reader ever requests.
        const res = await fetch(sample.url, {
          cache: "no-store",
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        if (!res.ok) {
          return {
            locale: sample.locale, base: sample.base, url: sample.url,
            verdict: "unreachable", dates: [], allowed, status: res.status,
          };
        }
        return classifyHub(sample, await res.text(), at, res.status);
      } catch (err) {
        return {
          locale: sample.locale, base: sample.base, url: sample.url,
          verdict: "unreachable", dates: [], allowed,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}
