import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { evaluateAlerts, lastHourCounts, ALERT_THRESHOLDS } from "@/lib/ops-events";

/**
 * What the hourly GitHub Actions job polls (docs/ops-alerts.md): the last hour's
 * production incident counts, and the alerts they trigger.
 *
 * Behind its own bearer token, OPS_ALERT_TOKEN, which can read these counts and
 * nothing else — so the Supabase service key never has to leave Vercel. With
 * the token unset the route is closed (503), never open.
 *
 * A 500 here is itself an alert: it means the heartbeat write or the read
 * failed, i.e. the monitoring is blind.
 */
export const dynamic = "force-dynamic";

function authorized(header: string | null, token: string): boolean {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(request: NextRequest) {
  const token = process.env.OPS_ALERT_TOKEN;
  if (!token) return NextResponse.json({ error: "OPS_ALERT_TOKEN is not configured" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const headers = { "Cache-Control": "no-store" };
  try {
    const { counts, recent } = await lastHourCounts();
    return NextResponse.json(
      { window: "1h", env: "production", thresholds: ALERT_THRESHOLDS, counts, alerts: evaluateAlerts(counts), recent },
      { headers },
    );
  } catch (err) {
    console.error("[api/ops/alerts] monitoring failed:", err);
    return NextResponse.json({ error: `monitoring failed: ${(err as Error).message}` }, { status: 500, headers });
  }
}
