import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, removeSubscription } from "@/lib/push-store";

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(request.url);
    const testSecret = url.searchParams.get("secret");
    const isAuthorized =
      !!cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || testSecret === cronSecret);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const endpointFilter = url.searchParams.get("endpoint");
    const customTitle = url.searchParams.get("title") ?? "Test VitaminD";
    const customBody = url.searchParams.get("body");

    const allSubs = await getAllSubscriptions();
    const subs = endpointFilter
      ? allSubs.filter((s) => s.subscription.endpoint === endpointFilter)
      : allSubs;

    if (!subs.length) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        total: allSubs.length,
        matched: 0,
        detail: endpointFilter
          ? `No subscription matched endpoint=${endpointFilter}`
          : "No subscriptions found",
      });
    }

    const webpush = await getWebPush();
    const now = new Date().toISOString().slice(11, 19);
    let sent = 0;
    let failed = 0;
    const results: { endpoint: string; status: "sent" | "failed" | "removed"; reason?: string }[] = [];

    for (const sub of subs) {
      const body =
        customBody ??
        `[${now}] Test push para ${sub.cityName || "tu ubicación"} — si ves esto, las notifications funcionan.`;
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: customTitle,
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: { url: "/", test: true },
          }),
        );
        sent++;
        results.push({ endpoint: sub.subscription.endpoint, status: "sent" });
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        const message = err instanceof Error ? err.message : String(err);
        if (statusCode === 410 || statusCode === 404) {
          await removeSubscription(sub.subscription.endpoint);
          results.push({
            endpoint: sub.subscription.endpoint,
            status: "removed",
            reason: `Expired (${statusCode})`,
          });
        } else {
          results.push({
            endpoint: sub.subscription.endpoint,
            status: "failed",
            reason: `${statusCode ?? "unknown"}: ${message}`,
          });
        }
        failed++;
      }
    }

    return NextResponse.json({
      sent,
      failed,
      total: allSubs.length,
      matched: subs.length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Test push failed", detail: message }, { status: 500 });
  }
}
