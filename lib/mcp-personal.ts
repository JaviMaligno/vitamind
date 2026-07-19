import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_CITIES } from "./cities";
import type { City, DayRecord } from "./types";

/**
 * Personal (OAuth-scoped) MCP tools. Everything a user has lives in their
 * single `profiles` row (see lib/profile.ts); these helpers read/write it via
 * the service role, keyed strictly by the token's user id. Injectable store so
 * the tools are unit-testable without Supabase.
 */

export interface ProfileRow {
  skin_type: number | null;
  area_fraction: number | null;
  age: number | null;
  target_iu: number | null;
  favorites: string[] | null;
  custom_locations: City[] | null;
  last_city_id: string | null;
  history: DayRecord[] | null;
}

export interface ProfileStore {
  getProfile(userId: string): Promise<ProfileRow | null>;
  updateHistory(userId: string, history: DayRecord[]): Promise<void>;
}

function cityRef(cityId: string, custom: City[]): { name: string; lat: number; lon: number; timezone?: string } | null {
  const c = BUILTIN_CITIES.find((b) => b.id === cityId) ?? custom.find((b) => b.id === cityId);
  return c ? { name: c.name, lat: c.lat, lon: c.lon, timezone: c.timezone } : null;
}

const NO_PROFILE = {
  error: "no_profile" as const,
  hint: "This account has no saved profile yet. Open the app, sign in and save your profile first.",
};

export async function myProfileTool(store: ProfileStore, userId: string) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;
  const custom = p.custom_locations ?? [];
  return {
    skinType: p.skin_type ?? 3,
    exposedSkinFraction: p.area_fraction ?? 0.25,
    age: p.age,
    targetIU: p.target_iu ?? 1000,
    currentCity: p.last_city_id ? cityRef(p.last_city_id, custom) : null,
    favoriteCount: (p.favorites ?? []).length,
    trackedDays: (p.history ?? []).length,
    hint: "Pass these values to the public tools (get_vitamin_d_window, get_current_status…) instead of asking the user again.",
  };
}

export async function myCitiesTool(store: ProfileStore, userId: string) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;
  const custom = p.custom_locations ?? [];
  const favorites = (p.favorites ?? [])
    .map((id) => cityRef(id, custom))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  return {
    currentCity: p.last_city_id ? cityRef(p.last_city_id, custom) : null,
    favorites,
  };
}

export async function myHistoryTool(store: ProfileStore, userId: string, args: { days?: number }) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;
  const days = Math.min(365, Math.max(1, Math.round(args.days ?? 30)));
  const history = [...(p.history ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = history.slice(0, days);

  const confirmed = recent.filter((r) => r.userOverride === true).length;
  const sufficient = recent.filter((r) => r.sufficient).length;

  // Streak of consecutive confirmed days ending at the most recent record.
  let streak = 0;
  for (const r of recent) {
    if (r.userOverride === true) streak += 1;
    else break;
  }

  return {
    daysRequested: days,
    daysTracked: recent.length,
    daysConfirmedOutside: confirmed,
    daysWithViableSun: sufficient,
    currentConfirmedStreak: streak,
    records: recent.map((r) => ({
      date: r.date,
      cityId: r.cityId,
      viableSun: r.sufficient,
      wentOutside: r.userOverride,
      minutesNeeded: Math.round(r.minutesNeeded),
    })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function logSunSessionTool(
  store: ProfileStore,
  userId: string,
  args: { date?: string; minutes?: number },
) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;

  const date = args.date && DATE_RE.test(args.date) ? args.date : new Date().toISOString().slice(0, 10);
  const history = [...(p.history ?? [])];
  const existing = history.find((r) => r.date === date);

  if (existing) {
    existing.userOverride = true;
  } else {
    history.push({
      date,
      cityId: p.last_city_id ?? "",
      peakUVI: 0,
      windowStart: 0,
      windowEnd: 0,
      minutesNeeded: 0,
      sufficient: false,
      userOverride: true,
    });
  }
  await store.updateHistory(userId, history);

  return {
    logged: true,
    date,
    minutesReported: args.minutes ?? null,
    note: "Day marked as sun-confirmed in the app's history calendar. Reported minutes are acknowledged but not stored — the history tracks confirmed days.",
  };
}

// ---------------------------------------------------------------------------
// Production store

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

class SupabaseProfileStore implements ProfileStore {
  constructor(private sb: SupabaseClient) {}

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await this.sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(`profiles read failed: ${error.message}`);
    return (data as ProfileRow) ?? null;
  }

  async updateHistory(userId: string, history: DayRecord[]): Promise<void> {
    const { error } = await this.sb
      .from("profiles")
      .update({ history, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(`profiles history update failed: ${error.message}`);
  }
}

export function getProfileStore(): ProfileStore | null {
  const sb = getServiceClient();
  return sb ? new SupabaseProfileStore(sb) : null;
}
