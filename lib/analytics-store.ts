import { createClient } from "@supabase/supabase-js";
import type { CleanPayload } from "./analytics-ingest";

/**
 * Writer for the analytics event stream.
 *
 * Uses the service role key, like every other server path in this project:
 * `analytics_events` has RLS on with no policies, so the anon key that ships to
 * browsers can neither read the stream nor write to it.
 */

function requireServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase service client unavailable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
    );
  }
  return createClient(url, key);
}

/**
 * Insert one validated batch.
 *
 * Raises on error rather than swallowing it — the same lesson `lib/push-store.ts`
 * carries in its header comment: a store that returns quietly on failure hid two
 * separate production outages here for ~50 days each, because every caller saw
 * success. The route turns this into a 500 the client ignores; nobody's page
 * breaks, but the failure is visible in the logs instead of invisible everywhere.
 */
export async function insertEvents(payload: CleanPayload, host: string | null): Promise<number> {
  const sb = requireServiceClient();

  const rows = payload.events.map((e) => ({
    visitor_id: payload.visitorId,
    session_id: payload.sessionId,
    name: e.name,
    props: e.props,
    path: e.path,
    locale: e.locale,
    referrer_host: e.referrerHost,
    authed: e.authed,
    occurred_at: e.occurredAt,
    host,
  }));

  const { error } = await sb.from("analytics_events").insert(rows);
  if (error) {
    throw new Error(`analytics insert failed: ${error.message}`);
  }
  return rows.length;
}
