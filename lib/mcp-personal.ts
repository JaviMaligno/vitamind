import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_CITIES } from "./cities";
import { buildHistoryWindow, parseGpsCityId } from "./history-window";
import type { WeatherRangeFetcher } from "./weather-range";
import type { SkinType } from "./vitd";
import type { City, DayRecord } from "./types";

/** Whole hours as HH:MM, matching how the other tools spell a window. */
const hhFromHour = (hour: number) => `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;

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
  updateProfile(userId: string, patch: ProfilePatch): Promise<void>;
}

/** The four synthesis inputs, and only those: nothing else is writable here. */
export interface ProfilePatch {
  skin_type?: number;
  area_fraction?: number;
  age?: number | null;
  target_iu?: number;
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

/** YYYY-MM-DD `offset` days before `now`, read in UTC so the string is stable. */
function isoDaysBefore(now: Date, offset: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
  return d.toISOString().slice(0, 10);
}

/**
 * `days` is a span of calendar days ending today — not a count of stored records.
 *
 * Slicing the record list instead meant the window stretched to cover whatever
 * gaps the user's history had: eight records spread over three months came back
 * for `days: 30`, and a calendar drawn from them showed a month that was really
 * a season.
 *
 * Every day in the span is answered, whether or not the app was open that day:
 * the window and the minutes are derived from the current profile and the
 * weather that actually happened, and only "did you go outside" comes from the
 * stored record. See lib/history-window.ts for why.
 */
export async function myHistoryTool(
  store: ProfileStore,
  userId: string,
  args: { days?: number },
  now: Date = new Date(),
  fetchRange?: WeatherRangeFetcher,
) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;
  const days = Math.min(365, Math.max(1, Math.round(args.days ?? 30)));
  const to = isoDaysBefore(now, 0);
  const from = isoDaysBefore(now, days - 1);
  const history = [...(p.history ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = history.filter((r) => r.date >= from && r.date <= to);

  const custom = p.custom_locations ?? [];
  const window = await buildHistoryWindow({
    from, to, records: recent,
    profile: {
      skinType: (p.skin_type ?? 3) as SkinType,
      area: p.area_fraction ?? 0.25,
      targetIU: p.target_iu ?? 1000,
      age: p.age ?? null,
    },
    resolveCity: (cityId) => cityRef(cityId, custom) ?? parseGpsCityId(cityId),
    fetchRange,
  });

  // Newest first, as the answer has always been.
  const ordered = [...window].reverse();
  const confirmed = ordered.filter((d) => d.wentOutside === true).length;
  const sufficient = ordered.filter((d) => d.sufficient).length;

  // Streak of consecutive confirmed days ending today.
  let streak = 0;
  for (const d of ordered) {
    if (d.wentOutside === true) streak += 1;
    else break;
  }

  return {
    daysRequested: days,
    from,
    to,
    daysTracked: recent.length,
    daysNotAnswered: ordered.filter((d) => d.wentOutside === null).length,
    // The window and the minutes are computed, not remembered, so they always
    // match the profile in force now. Stored records only ever answer one
    // question, and a day with no record is a day with no answer — not a day
    // with no sun.
    howToRead: "Every day in from..to is answered. `window`, `minutesNeeded` and `peakUVI` are computed from the current profile and that day's weather; `uvSource` says whether the cloud cover was measured or modelled. `wentOutside` is null unless the user said so — never infer it. `locationAssumed` means the place was carried over from a neighbouring day.",
    daysConfirmedOutside: confirmed,
    daysWithViableSun: sufficient,
    currentConfirmedStreak: streak,
    records: ordered.map((r) => ({
      date: r.date,
      cityId: r.cityId,
      locationAssumed: r.locationAssumed,
      uvSource: r.uvSource,
      peakUVI: r.peakUVI,
      window: r.windowStart !== null && r.windowEnd !== null
        ? { start: hhFromHour(r.windowStart), end: hhFromHour(r.windowEnd) }
        : null,
      viableSun: r.sufficient,
      wentOutside: r.wentOutside,
      minutesNeeded: r.minutesNeeded,
    })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Sets a day's answer in the history calendar — the same edit the app's own
 * calendar makes when you tap a day, and with the same three values.
 *
 * `true` went out, `false` had sun and stayed in, `null` never answered. The
 * three are distinct on purpose: a deliberate "no" is a fact, a missing answer is
 * not, and conflating them would quietly inflate whatever reads the history.
 * Mirrors `toggleDayOverride` in lib/storage.ts.
 */
export async function logSunSessionTool(
  store: ProfileStore,
  userId: string,
  args: { date?: string; minutes?: number; confirmed?: boolean | null },
) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;

  const confirmed = args.confirmed === undefined ? true : args.confirmed;
  const date = args.date && DATE_RE.test(args.date) ? args.date : new Date().toISOString().slice(0, 10);
  const history = [...(p.history ?? [])];
  const existing = history.find((r) => r.date === date);

  if (existing) {
    existing.userOverride = confirmed;
  } else if (confirmed === true) {
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
  } else {
    // Nothing recorded for that day, and the answer is not "I went out": there is
    // no row to annotate, and inventing one would record a day the app never
    // evaluated.
    return { logged: false, date, confirmed, note: "That day is not in the history, so there was nothing to set." };
  }

  await store.updateHistory(userId, history);

  return {
    logged: true,
    date,
    confirmed,
    minutesReported: args.minutes ?? null,
    note: confirmed === true
      ? "Day marked as sun-confirmed in the app's history calendar. Reported minutes are acknowledged but not stored — the history tracks confirmed days."
      : confirmed === false
        ? "Day marked as 'had sun, stayed in' in the app's history calendar."
        : "Answer cleared for that day: it is back to unanswered.",
  };
}

/**
 * Writes the four synthesis inputs to the signed-in user's saved profile — the
 * same row the app's own profile screen edits, so a change made from the chat
 * shows up in the app and vice versa.
 *
 * Deliberately narrow: favourites, custom locations, the current city and the
 * history are NOT writable from here. A tool that can rewrite a user's whole
 * profile row is a much bigger thing to hand a language model than one that can
 * set their skin type.
 */
export async function updateMyProfileTool(
  store: ProfileStore,
  userId: string,
  args: { skinType?: number; exposedSkinFraction?: number; age?: number | null; targetIU?: number },
) {
  const p = await store.getProfile(userId);
  if (!p) return NO_PROFILE;

  const patch: ProfilePatch = {};
  if (args.skinType !== undefined) patch.skin_type = Math.min(6, Math.max(1, Math.round(args.skinType)));
  if (args.exposedSkinFraction !== undefined) {
    patch.area_fraction = Math.min(1, Math.max(0.05, args.exposedSkinFraction));
  }
  if (args.age !== undefined) patch.age = args.age === null ? null : Math.min(120, Math.max(0, Math.round(args.age)));
  if (args.targetIU !== undefined) patch.target_iu = Math.min(10000, Math.max(100, Math.round(args.targetIU)));

  if (Object.keys(patch).length === 0) {
    return { saved: false, reason: "nothing_to_update", hint: "Pass at least one of skinType, exposedSkinFraction, age or targetIU." };
  }

  await store.updateProfile(userId, patch);

  return {
    saved: true,
    profile: {
      skinType: patch.skin_type ?? p.skin_type,
      exposedSkinFraction: patch.area_fraction ?? p.area_fraction,
      age: patch.age !== undefined ? patch.age : p.age,
      targetIU: patch.target_iu ?? p.target_iu,
    },
    note: "Saved to the user's account. The app and every later tool call now use these values.",
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

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    const { error } = await this.sb
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(`profiles update failed: ${error.message}`);
  }
}

export function getProfileStore(): ProfileStore | null {
  const sb = getServiceClient();
  return sb ? new SupabaseProfileStore(sb) : null;
}
