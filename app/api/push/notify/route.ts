import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, removeSubscription } from "@/lib/push-store";
import { getCurve, getWindow, dayOfYear, fmtTime } from "@/lib/solar";
import { minutesForVitD, type SkinType } from "@/lib/vitd";

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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&start_date=${today}&end_date=${today}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.hourly?.time) return [];
  return data.hourly.time.map((t: string, i: number) => ({
    hour: new Date(t).getHours(),
    uvi: data.hourly.uv_index?.[i] ?? 0,
  }));
}

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await getAllSubscriptions();
  if (!subs.length) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  const doy = dayOfYear(new Date());
  const webpush = await getWebPush();
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      // Calculate solar window
      const curve = getCurve(sub.lat, sub.lon, doy, sub.tz);
      const win = getWindow(curve, sub.threshold);

      if (!win) continue; // No vitamin D window today

      // Fetch real UV data
      const uvData = await fetchUVI(sub.lat, sub.lon);
      const peakUV = uvData.length ? Math.max(...uvData.map((h) => h.uvi)) : 0;

      if (peakUV < 3) continue; // UV too low

      // Calculate exposure time
      const mins = minutesForVitD(peakUV, sub.skinType as SkinType, sub.areaFraction);

      const body = mins !== null
        ? `${sub.cityName}: ${Math.round(mins)} min al sol para 1000 IU. Ventana: ${fmtTime(win.start)} – ${fmtTime(win.end)}. UV pico: ${peakUV.toFixed(1)}`
        : `${sub.cityName}: Ventana de sol ${fmtTime(win.start)} – ${fmtTime(win.end)}`;

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
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired, remove it
        await removeSubscription(sub.subscription.endpoint);
      }
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: subs.length });
}
