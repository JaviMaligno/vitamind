import { createClient } from "@supabase/supabase-js";
import type { PushSubscription as WebPushSubscription } from "web-push";

export interface StoredSubscription {
  subscription: WebPushSubscription;
  lat: number;
  lon: number;
  tz: number;
  skinType: number;
  areaFraction: number;
  cityName: string;
  createdAt: number;
}

// Use service_role key for server-side push operations (reads all subscriptions)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}


export async function saveSubscription(sub: StoredSubscription): Promise<void> {
  // Use service role key to bypass RLS for server-side subscription management
  const sb = getServiceClient();
  if (!sb) return;

  await sb.from("push_subscriptions").upsert({
    endpoint: sub.subscription.endpoint,
    subscription: sub.subscription,
    lat: sub.lat,
    lon: sub.lon,
    tz: sub.tz,
    skin_type: sub.skinType,
    area_fraction: sub.areaFraction,
    city_name: sub.cityName,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  // Use service role key to bypass RLS for server-side subscription management
  const sb = getServiceClient();
  if (!sb) return;

  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function getAllSubscriptions(): Promise<StoredSubscription[]> {
  const sb = getServiceClient();
  if (!sb) return [];

  const { data, error } = await sb.from("push_subscriptions").select("*");
  if (error || !data) return [];

  return data.map((row) => ({
    subscription: row.subscription as WebPushSubscription,
    lat: row.lat,
    lon: row.lon,
    tz: row.tz,
    skinType: row.skin_type,
    areaFraction: row.area_fraction,
    cityName: row.city_name,
    createdAt: new Date(row.created_at).getTime(),
  }));
}
