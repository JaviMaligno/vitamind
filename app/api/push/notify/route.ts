import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, removeSubscription, type StoredSubscription } from "@/lib/push-store";
import { getCurve, dayOfYear, fmtTime } from "@/lib/solar";
import { minutesForVitD, computeExposureFromCurve, type SkinType } from "@/lib/vitd";

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
  webpush.setVapidDetails(
    "mailto:vitamind@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return webpush;
}

export const dynamic = "force-dynamic";

async function fetchUVI(lat: number, lon: number): Promise<{ hour: number; uvi: number }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&start_date=${today}&end_date=${today}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return [];
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
    const exposure = computeExposureFromCurve(curve, sub.skinType as SkinType, sub.areaFraction);
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

    const doy = dayOfYear(new Date());
    const webpush = await getWebPush();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: { endpoint: string; reason: string }[] = [];

    for (const sub of subs) {
      const result = await sendForSubscription(sub, doy, webpush, force);
      if (result.sent) sent++;
      if (result.skipped) skipped++;
      if (result.failed) failed++;
      if (result.error) errors.push(result.error);
    }

    return NextResponse.json({
      sent,
      skipped,
      failed,
      total: subs.length,
      mode: force ? "force-test" : "cron",
      errors: errors.length ? errors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Notify failed", detail: message }, { status: 500 });
  }
}
