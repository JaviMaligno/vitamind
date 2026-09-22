import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";

/**
 * Operational incidents, and the thresholds that turn them into alerts.
 *
 * WHY. On Hobby, Vercel keeps runtime logs for one hour and has no alerts or
 * drains. On 2026-09-22 the preview spent ~10 minutes answering 502 because
 * Open-Meteo refused its requests, and the only trace was a log line that
 * expired before anyone read it. So upstream failures land in `ops_events`, and
 * an hourly GitHub Actions job asks /api/ops/alerts whether any threshold was
 * crossed — which opens an issue and fails the run, i.e. an email.
 * docs/ops-alerts.md.
 */

export type OpsKind = "upstream_error" | "upstream_timeout" | "fallback" | "heartbeat";

export interface OpsEvent {
  source: string;
  kind: OpsKind;
  upstream: string | null;
  status: number | null;
  detail: string | null;
}

export type OpsCounts = Record<"upstream_error" | "upstream_timeout" | "fallback", number>;

export interface OpsAlert {
  severity: "critical" | "warning";
  count: number;
  message: string;
}

/**
 * Per hour, production only. Traffic is low, so the numbers are small on
 * purpose: three failed requests in an hour is three readers who saw an error.
 */
export const ALERT_THRESHOLDS = {
  /** Upstream errors plus timeouts: a reader got an error instead of a forecast. */
  failures: 3,
  /** The degraded path answered instead of the five-model median. */
  fallbacks: 10,
} as const;

export function evaluateAlerts(c: OpsCounts): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const failures = c.upstream_error + c.upstream_timeout;
  if (failures >= ALERT_THRESHOLDS.failures) {
    alerts.push({
      severity: "critical",
      count: failures,
      message: `${failures} upstream failures in the last hour (${c.upstream_error} errors, ${c.upstream_timeout} timeouts): readers got an error instead of a forecast.`,
    });
  }
  if (c.fallback >= ALERT_THRESHOLDS.fallbacks) {
    alerts.push({
      severity: "warning",
      count: c.fallback,
      message: `${c.fallback} fallbacks in the last hour: forecasts were served without the five-model cloud median.`,
    });
  }
  return alerts;
}

/** Which deployment wrote a row. Preview traffic must never page anyone. */
export function opsEnv(): string {
  return process.env.VERCEL_ENV || "development";
}

/** Coordinates never belong in an incident row, even inside an upstream's error text. */
const scrub = (s: string) => s.replace(/-?\d{1,3}\.\d+/g, "#").slice(0, 200);

/**
 * Describe a failed upstream call from its response or its exception. Only the
 * HOST of the URL is kept: the query string carries the reader's coordinates.
 */
export async function upstreamFailure(
  source: string,
  url: string,
  failure: Response | unknown,
  kind?: OpsKind,
): Promise<OpsEvent> {
  let upstream: string | null = null;
  try { upstream = new URL(url).hostname; } catch { /* keep null */ }
  if (failure instanceof Response) {
    const body = await failure.text().catch(() => "");
    return { source, kind: kind ?? "upstream_error", upstream, status: failure.status, detail: scrub(body) || null };
  }
  const name = (failure as { name?: string } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError") {
    return { source, kind: kind ?? "upstream_timeout", upstream, status: null, detail: name };
  }
  const message = (failure as { message?: string } | null)?.message;
  return { source, kind: kind ?? "upstream_error", upstream, status: null, detail: scrub(`${name ?? "Error"}: ${message ?? ""}`) };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service client unavailable for ops_events");
  return createClient(url, key);
}

/**
 * Write one incident. Never throws — it runs inside `after()`, once the reader
 * already has their answer, and an incident log must not become an incident.
 * It does not fail SILENTLY either: the error goes to the runtime log, and the
 * heartbeat /api/ops/alerts writes on every poll proves the write path works,
 * so a broken writer shows up as a failed poll rather than as a quiet week.
 */
export async function recordOpsEvent(e: OpsEvent): Promise<void> {
  try {
    const { error } = await serviceClient().from("ops_events").insert({ ...e, env: opsEnv() });
    if (error) console.error("[ops-events] insert failed:", error.message);
  } catch (err) {
    console.error("[ops-events] insert failed:", err);
  }
}

/**
 * Record an incident once the response has gone out. `after()` only exists
 * inside a request; anywhere else (tests, scripts) the write simply runs now.
 */
export function reportOpsEvent(event: OpsEvent | Promise<OpsEvent>): void {
  const run = () => Promise.resolve(event).then(recordOpsEvent);
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Last hour's counts for production, after writing and reading back a heartbeat.
 * Throws on any failure: the caller turns that into a 500, which the poller
 * reports as "monitoring is broken" — the one thing that must not be silent.
 */
export async function lastHourCounts(now: Date = new Date()): Promise<{ counts: OpsCounts; recent: OpsEvent[] }> {
  const sb = serviceClient();
  const beat = await sb.from("ops_events").insert({
    env: opsEnv(), source: "ops-alerts", kind: "heartbeat", upstream: null, status: null, detail: null,
  }).select("id").single();
  if (beat.error || !beat.data) throw new Error(`heartbeat write failed: ${beat.error?.message ?? "no row"}`);

  const since = new Date(now.getTime() - 3600_000).toISOString();
  const { data, error } = await sb
    .from("ops_events")
    .select("occurred_at, source, kind, upstream, status, detail")
    .eq("env", "production")
    .neq("kind", "heartbeat")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`ops_events read failed: ${error.message}`);

  const counts: OpsCounts = { upstream_error: 0, upstream_timeout: 0, fallback: 0 };
  for (const r of data ?? []) if (r.kind in counts) counts[r.kind as keyof OpsCounts] += 1;
  return { counts, recent: (data ?? []).slice(0, 5) as OpsEvent[] };
}
