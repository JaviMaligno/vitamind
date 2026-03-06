// Push subscription storage
// Uses Vercel KV when available, falls back to in-memory (dev only)

import type { PushSubscription as WebPushSubscription } from "web-push";

export interface StoredSubscription {
  subscription: WebPushSubscription;
  lat: number;
  lon: number;
  tz: number;
  skinType: number;
  areaFraction: number;
  threshold: number;
  cityName: string;
  createdAt: number;
}

let kvModule: typeof import("@vercel/kv") | null = null;

async function getKV() {
  if (kvModule) return kvModule;
  try {
    kvModule = await import("@vercel/kv");
    // Test if KV is configured
    await kvModule.kv.ping();
    return kvModule;
  } catch {
    return null;
  }
}

// In-memory fallback for development
const memStore = new Map<string, StoredSubscription>();

function subKey(endpoint: string): string {
  // Hash the endpoint to make a shorter key
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    hash = ((hash << 5) - hash + endpoint.charCodeAt(i)) | 0;
  }
  return `push:${Math.abs(hash).toString(36)}`;
}

export async function saveSubscription(sub: StoredSubscription): Promise<void> {
  const key = subKey(sub.subscription.endpoint);
  const kv = await getKV();
  if (kv) {
    await kv.kv.set(key, JSON.stringify(sub), { ex: 90 * 86400 }); // 90 day TTL
    await kv.kv.sadd("push:all", key);
  } else {
    memStore.set(key, sub);
  }
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const key = subKey(endpoint);
  const kv = await getKV();
  if (kv) {
    await kv.kv.del(key);
    await kv.kv.srem("push:all", key);
  } else {
    memStore.delete(key);
  }
}

export async function getAllSubscriptions(): Promise<StoredSubscription[]> {
  const kv = await getKV();
  if (kv) {
    const keys = await kv.kv.smembers("push:all") as string[];
    if (!keys.length) return [];
    const results: StoredSubscription[] = [];
    for (const key of keys) {
      const raw = await kv.kv.get(key) as string | null;
      if (raw) {
        try {
          results.push(typeof raw === "string" ? JSON.parse(raw) : raw as StoredSubscription);
        } catch { /* skip corrupted */ }
      } else {
        // Expired, clean up
        await kv.kv.srem("push:all", key);
      }
    }
    return results;
  }
  return Array.from(memStore.values());
}
