import { createClient } from "@supabase/supabase-js";
import type { PushSubscription as WebPushSubscription } from "web-push";

export interface StoredSubscription {
  subscription: WebPushSubscription;
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  skinType: number;
  areaFraction: number;
  cityName: string;
  locale: string;
  createdAt: number;
  /**
   * The subscriber's own calendar day (`YYYY-MM-DD`) on which the daily push was
   * last claimed, or undefined if it never was. See `claimNotification`.
   */
  lastNotifiedOn?: string;
}

// Use service_role key for server-side push operations (reads all subscriptions)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}


function requireServiceClient() {
  const sb = getServiceClient();
  if (!sb) {
    throw new Error(
      "Supabase service client unavailable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
    );
  }
  return sb;
}

export async function saveSubscription(sub: StoredSubscription): Promise<void> {
  // Use service role key to bypass RLS for server-side subscription management
  const sb = requireServiceClient();

  const { error } = await sb.from("push_subscriptions").upsert({
    endpoint: sub.subscription.endpoint,
    subscription: sub.subscription,
    lat: sub.lat,
    lon: sub.lon,
    tz: sub.tz,
    timezone: sub.timezone ?? null,
    skin_type: sub.skinType,
    area_fraction: sub.areaFraction,
    city_name: sub.cityName,
    locale: sub.locale,
    vapid_public_key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) throw new Error(`Failed to upsert push subscription: ${error.message}`);
}

/**
 * Updates only the `locale` of an existing subscription, without touching the
 * stored lat/lon/skinType/etc. Used by the app-wide PushLocaleSync so a stale
 * subscription (e.g. created before push localization, defaulting to "es") gets
 * corrected to the user's chosen language on any page load — not just /profile.
 * No-ops silently if the endpoint isn't found.
 */
export async function updateSubscriptionLocale(endpoint: string, locale: string): Promise<void> {
  const sb = requireServiceClient();
  const { error } = await sb
    .from("push_subscriptions")
    .update({ locale, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint);
  if (error) throw new Error(`Failed to update subscription locale: ${error.message}`);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  // Use service role key to bypass RLS for server-side subscription management
  const sb = requireServiceClient();
  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`Failed to delete push subscription: ${error.message}`);
}

export async function getAllSubscriptions(): Promise<StoredSubscription[]> {
  const sb = requireServiceClient();

  // Filter by current project's VAPID public key so prod and dev (vitamind-dev)
  // don't try to push to each other's subscriptions on the shared table.
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const query = sb.from("push_subscriptions").select("*");
  const { data, error } = publicKey
    ? await query.eq("vapid_public_key", publicKey)
    : await query;
  if (error) throw new Error(`Failed to read push subscriptions: ${error.message}`);
  if (!data) return [];

  return data.map((row) => ({
    subscription: row.subscription as WebPushSubscription,
    lat: row.lat,
    lon: row.lon,
    tz: row.tz,
    timezone: row.timezone ?? undefined,
    skinType: row.skin_type,
    areaFraction: row.area_fraction,
    cityName: row.city_name,
    locale: row.locale ?? "es",
    createdAt: new Date(row.created_at).getTime(),
    lastNotifiedOn: row.last_notified_on ?? undefined,
  }));
}

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Claim today's push for one subscription, on the SUBSCRIBER's calendar day.
 *
 * `/api/push/notify` is invoked once per UTC hour (24 daily cron entries, since
 * Hobby rejects a sub-daily expression) and sends to whoever is in their local
 * morning, so a given subscriber is eligible on two or three of those runs.
 * Vercel also documents that a scheduled run may be delivered more than once. The
 * claim is what turns "eligible on several runs" into exactly one push a day.
 *
 * It is a CONDITIONAL update rather than a read-then-write: the `or` filter makes
 * the row match only while it is not already stamped with this local day, so two
 * runs racing on the same subscription cannot both come back true. Returns
 * whether this caller got the day.
 *
 * The caller must claim BEFORE pushing. Losing the push after a successful claim
 * costs that subscriber one day's notification; pushing before claiming would
 * cost them a second copy of it, and the failure Vercel cannot retry is the one
 * that already reached the user's lock screen.
 */
export async function claimNotification(endpoint: string, localDay: string): Promise<boolean> {
  if (!LOCAL_DAY.test(localDay)) {
    // The value is interpolated into a PostgREST filter expression below, so it
    // is checked rather than trusted, even though every caller builds it.
    throw new Error(`Invalid local day for push claim: ${localDay}`);
  }
  const sb = requireServiceClient();
  const { data, error } = await sb
    .from("push_subscriptions")
    .update({ last_notified_on: localDay })
    .eq("endpoint", endpoint)
    .or(`last_notified_on.is.null,last_notified_on.neq.${localDay}`)
    .select("endpoint");
  if (error) throw new Error(`Failed to claim push notification: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
