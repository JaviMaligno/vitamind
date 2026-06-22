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
  }));
}
