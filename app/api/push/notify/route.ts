import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, removeSubscription } from "@/lib/push-store";
import { getCurve, dayOfYear, fmtTime } from "@/lib/solar";
import { minutesForVitD, computeExposureFromCurve, type SkinType } from "@/lib/vitd";

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

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    // Allow ?test=true with CRON_SECRET as query param for manual testing
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(request.url);
    const testSecret = url.searchParams.get("secret");
    const isAuthorized =
      !cronSecret ||
      authHeader === `Bearer ${cronSecret}` ||
      testSecret === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subs = await getAllSubscriptions();
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
      try {
        // Calculate UV-based synthesis window
        const curve = getCurve(sub.lat, sub.lon, doy, sub.tz, sub.timezone);
        const exposure = computeExposureFromCurve(
          curve,
          sub.skinType as SkinType,
          sub.areaFraction,
        );

        if (!exposure) {
          skipped++;
          continue; // No vitamin D window today
        }

        // Fetch real UV data for more accurate minutes
        const uvData = await fetchUVI(sub.lat, sub.lon);
        const peakUV = uvData.length ? Math.max(...uvData.map((h) => h.uvi)) : exposure.bestUVI;

        if (peakUV < 3) {
          skipped++;
          continue; // UV too low
        }

        // Calculate exposure time with real UV if available
        const mins = minutesForVitD(peakUV, sub.skinType as SkinType, sub.areaFraction);

        const body = mins !== null
          ? `${sub.cityName}: ${Math.round(mins)} min al sol para 1000 IU. Ventana: ${fmtTime(exposure.windowStart)} – ${fmtTime(exposure.windowEnd)}. UV pico: ${peakUV.toFixed(1)}`
          : `${sub.cityName}: Ventana de sol ${fmtTime(exposure.windowStart)} – ${fmtTime(exposure.windowEnd)}`;

        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: "Sol ideal para Vitamina D",
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: { url: "/" },
          }),
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        const message = err instanceof Error ? err.message : String(err);
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired, remove it
          await removeSubscription(sub.subscription.endpoint);
          errors.push({ endpoint: sub.subscription.endpoint, reason: `Expired (${statusCode}), removed` });
        } else {
          errors.push({ endpoint: sub.subscription.endpoint, reason: `${statusCode ?? "unknown"}: ${message}` });
        }
        failed++;
      }
    }

    return NextResponse.json({ sent, skipped, failed, total: subs.length, errors: errors.length ? errors : undefined });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Notify failed", detail: message }, { status: 500 });
  }
}
