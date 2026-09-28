import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";

export type McpOutcome = "success" | "tool_error" | "authentication_required" | "insufficient_scope" | "exception";
export interface McpCall {
  tool: string;
  occurred_at: string;
  duration_ms: number;
  outcome: McpOutcome;
}

/** Service-role only. Never persist arguments, results, errors, identities or tokens. */
export async function recordMcpCall(call: McpCall): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("MCP analytics service client unavailable");
    const { error } = await createClient(url, key).from("mcp_call_events").insert({
      tool: call.tool,
      occurred_at: call.occurred_at,
      duration_ms: call.duration_ms,
      outcome: call.outcome,
      env: process.env.VERCEL_ENV || "development",
    }).abortSignal(AbortSignal.timeout(3000));
    if (error) throw error;
  } catch {
    // Only persistence failures reach runtime logs. Never print the exception:
    // upstream messages can contain credentials or user-controlled payloads.
    console.error("[mcp-analytics] insert failed");
  }
}

function outcomeOf(value: unknown): McpOutcome {
  const result = value as { isError?: boolean; content?: Array<{ type: string; text?: string }> } | null;
  if (result?.isError) return "tool_error";
  // Our handlers encode their domain errors as JSON text, not isError. Inspect
  // only that envelope; no payload or error message is retained in analytics.
  for (const block of result?.content ?? []) {
    if (block.type !== "text" || !block.text) continue;
    let payload: { error?: unknown } | null;
    try { payload = JSON.parse(block.text); } catch { continue; }
    if (payload?.error === "authentication_required") return "authentication_required";
    if (payload?.error === "insufficient_scope") return "insufficient_scope";
    if (payload?.error) return "tool_error";
  }
  return "success";
}

/** One row per invoked handler, including personal-tool auth refusals.
 * after() keeps the write alive after the HTTP response on Vercel. Scripts and
 * protocol tests have no Next request context, so they await the write instead.
 * Transport auth failures, invalid parameters and tools/list never reach here.
 */
export async function measureMcpCall<T>(tool: string, run: () => T | Promise<T>): Promise<T> {
  const occurred_at = new Date().toISOString();
  const started = performance.now();
  let outcome: McpOutcome = "exception";
  try {
    const result = await run();
    outcome = outcomeOf(result);
    return result;
  } finally {
    const call: McpCall = {
      tool, occurred_at, outcome,
      duration_ms: Math.max(0, Math.round(performance.now() - started)),
    };
    try { after(() => recordMcpCall(call)); }
    catch { await recordMcpCall(call); }
  }
}
