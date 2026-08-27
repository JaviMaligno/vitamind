import { NextRequest, NextResponse } from "next/server";
import {
  claimNotification,
  getAllSubscriptions,
  removeSubscription,
  type StoredSubscription,
} from "@/lib/push-store";
import { notifyDecision } from "@/lib/push-schedule";
import { getCurve, dayOfYear, fmtTime } from "@/lib/solar";
import { minutesForVitD, computeExposureFromCurve, type SkinType } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

/**
 * The daily "go out in the sun" push, sent on the SUBSCRIBER's clock.
 *
 * This used to be one cron at 08:00 UTC that iterated every stored subscription.
 * 08:00 UTC is a wall-clock time for the server and for nobody else: the notice
 * landed at 10:00 in Madrid, 04:00 in New York, 01:00 in Los Angeles and 17:00 in
 * Tokyo. Half the recipients were asleep and the other half had already lost the
 * synthesis window the message was naming.
 *
 * `vercel.json` now schedules this path once for every UTC hour and each run
 * sends only to the subscriptions whose own clock is inside the morning window
 * in `lib/push-schedule.ts`. It is 24 separate daily entries rather than a single
 * `0 * * * *` because the account is on Vercel's Hobby plan, where any expression
 * that would run more than once a day fails the deployment outright; the same
 * plan invokes each entry anywhere inside its hour, which is why the window is
 * three hours wide rather than one.
 *
 * Being eligible on several runs is safe because the day is CLAIMED before it is
 * pushed (`claimNotification`), keyed on the subscriber's local date.
 */
const SUPPORTED_LOCALES = ["es", "en", "fr", "de", "ru", "lt"];

interface PushMessages {
  title: string;
  testTitle: string;
  body: string;
  bodyNoMins: string;
  test: string;
  fallbackCity: string;
}

const messagesCache = new Map<string, PushMessages>();

async function getPushMessages(locale: string): Promise<PushMessages> {
  const lang = SUPPORTED_LOCALES.includes(locale) ? locale : "es";
  const cached = messagesCache.get(lang);
  if (cached) return cached;
  const all = (await import(`../../../../messages/${lang}.json`)).default;
  const push = all.notifications.push as PushMessages;
  messagesCache.set(lang, push);
  return push;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// Dynamic import to avoid build-time issues with web-push native modules
async function getWebPush() {
  const webpush = (await import("web-push")).default;
  // Push services use this contact on abuse/delivery issues; a fake address
  // risks silent deliverability problems, so it must be a monitored inbox.
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT ?? "mailto:vitamind@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return webpush;
}

export const dynamic = "force-dynamic";

async function fetchUVI(lat: number, lon: number): Promise<{ hour: number; uvi: number }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&start_date=${today}&end_date=${today}&timezone=auto`;
  // Timeout so one stalled Open-Meteo call can't hang the whole cron run past
  // the function limit (subscriptions are processed sequentially).
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json();
  if (!data.hourly?.time) return [];
  return data.hourly.time.map((t: string, i: number) => ({
    hour: parseInt(t.slice(11, 13), 10),
    uvi: data.hourly.uv_index?.[i] ?? 0,
  }));
}

interface SendResult {
  sent: boolean;
  skipped: boolean;
  failed: boolean;
  error?: { endpoint: string; reason: string };
}

async function sendForSubscription(
  sub: StoredSubscription,
  doy: number,
  webpush: Awaited<ReturnType<typeof getWebPush>>,
  force: boolean,
): Promise<SendResult> {
  const m = await getPushMessages(sub.locale);
  let body: string;

  if (force) {
    const stamp = new Date().toISOString().slice(11, 19);
    body = interpolate(m.test, { stamp, city: sub.cityName || m.fallbackCity });
  } else {
    const curve = getCurve(sub.lat, sub.lon, doy, sub.tz, sub.timezone);
    // Real ozone column for this subscriber's location/day. Elevation is not
    // stored per subscription, so altitude defaults to sea level.
    const ctx = { ozoneDu: ozoneDU(sub.lat, sub.lon, doy) };
    const exposure = computeExposureFromCurve(curve, sub.skinType as SkinType, sub.areaFraction, 1000, null, ctx);
    if (!exposure) return { sent: false, skipped: true, failed: false };

    const uvData = await fetchUVI(sub.lat, sub.lon);
    const peakUV = uvData.length ? Math.max(...uvData.map((h) => h.uvi)) : exposure.bestUVI;
    if (peakUV < 3) return { sent: false, skipped: true, failed: false };

    const mins = minutesForVitD(peakUV, sub.skinType as SkinType, sub.areaFraction);
    const city = sub.cityName || m.fallbackCity;
    const start = fmtTime(exposure.windowStart);
    const end = fmtTime(exposure.windowEnd);
    body = mins !== null
      ? interpolate(m.body, { city, mins: String(Math.round(mins)), start, end, uv: peakUV.toFixed(1) })
      : interpolate(m.bodyNoMins, { city, start, end });
  }

  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({
        title: force ? m.testTitle : m.title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/" },
      }),
    );
    return { sent: true, skipped: false, failed: false };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const message = err instanceof Error ? err.message : String(err);
    if (statusCode === 410 || statusCode === 404) {
      await removeSubscription(sub.subscription.endpoint);
      return {
        sent: false,
        skipped: false,
        failed: true,
        error: { endpoint: sub.subscription.endpoint, reason: `Expired (${statusCode}), removed` },
      };
    }
    return {
      sent: false,
      skipped: false,
      failed: true,
      error: { endpoint: sub.subscription.endpoint, reason: `${statusCode ?? "unknown"}: ${message}` },
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    let subs = await getAllSubscriptions();

    if (force) {
      const allowed = process.env.PUSH_TEST_ALLOWED_ENDPOINT;
      if (!allowed) {
        return NextResponse.json(
          { error: "force=true requires PUSH_TEST_ALLOWED_ENDPOINT env var" },
          { status: 400 },
        );
      }
      subs = subs.filter((s) => s.subscription.endpoint === allowed);
      if (!subs.length) {
        return NextResponse.json({
          sent: 0, skipped: 0, failed: 0, total: 0,
          detail: "No subscription matched PUSH_TEST_ALLOWED_ENDPOINT",
        });
      }
    }

    if (!subs.length) {
      return NextResponse.json({ sent: 0, skipped: 0, failed: 0, total: 0, detail: "No subscriptions found" });
    }

    const now = new Date();
    const webpush = await getWebPush();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let deferred = 0;
    const errors: { endpoint: string; reason: string }[] = [];

    for (const sub of subs) {
      const decision = notifyDecision(now, sub);

      // Force mode is a manual delivery test: it must fire whatever the clock
      // says and however many times it is asked, so it takes neither gate.
      if (!force) {
        if (!decision.due) {
          deferred++;
          continue;
        }
        try {
          if (!(await claimNotification(sub.subscription.endpoint, decision.localDay))) {
            // Another invocation of this same local day got there first.
            deferred++;
            continue;
          }
        } catch (err) {
          // Without the claim there is no once-a-day guard, and this endpoint
          // now runs 24 times a day. Skip the push rather than risk repeating
          // it, and let the run report the failure.
          failed++;
          errors.push({
            endpoint: sub.subscription.endpoint,
            reason: `claim failed: ${err instanceof Error ? err.message : String(err)}`,
          });
          continue;
        }
      }

      // The day the SUBSCRIBER is living, not the one the server is: at 09:00 in
      // Kiritimati it is still yesterday in UTC, and the solar curve is a
      // function of the day.
      const doy = dayOfYear(new Date(`${decision.localDay}T00:00:00Z`));
      const result = await sendForSubscription(sub, doy, webpush, force);
      if (result.sent) sent++;
      if (result.skipped) skipped++;
      if (result.failed) failed++;
      if (result.error) errors.push(result.error);
    }

    // Log the outcome so failed pushes are visible in Vercel function logs —
    // the response body of a cron invocation is never read by anyone.
    const summary = {
      sent,
      skipped,
      deferred,
      failed,
      total: subs.length,
      mode: force ? "force-test" : "cron",
    };
    if (errors.length) {
      console.error("[api/push/notify] run finished with errors:", JSON.stringify({ ...summary, errors }));
    } else {
      console.log("[api/push/notify] run finished:", JSON.stringify(summary));
    }

    // If every delivery attempt failed, something systemic is wrong (bad VAPID
    // keys, Supabase down…). Return non-2xx so Vercel marks the cron run failed.
    if (subs.length > 0 && failed === subs.length) {
      return NextResponse.json({ ...summary, errors }, { status: 500 });
    }

    return NextResponse.json({
      ...summary,
      errors: errors.length ? errors : undefined,
    });
  } catch (err: unknown) {
    console.error("[api/push/notify] failed:", err);
    return NextResponse.json({ error: "Notify failed" }, { status: 500 });
  }
}
