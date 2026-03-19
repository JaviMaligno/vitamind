import { getSupabase } from "./supabase";
import { loadFavorites, saveFavorites, loadCustomLocations, saveCustomLocation, deleteCustomLocation, loadPreferences, savePreferences, loadHistory, saveHistory } from "./storage";
import type { City, DayRecord, Preferences, UserProfile } from "./types";

// Load full profile: from Supabase if logged in, localStorage otherwise
export async function loadProfile(): Promise<{ profile: UserProfile | null; isLoggedIn: boolean }> {
  const sb = getSupabase();
  if (!sb) return { profile: null, isLoggedIn: false };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { profile: null, isLoggedIn: false };

  const { data } = await sb.from("profiles").select("*").eq("id", user.id).single();

  if (data) {
    return {
      isLoggedIn: true,
      profile: {
        id: user.id,
        email: user.email || "",
        skinType: data.skin_type ?? 3,
        areaFraction: data.area_fraction ?? 0.25,
        age: data.age ?? null,
        threshold: data.threshold ?? 50,
        favorites: data.favorites ?? [],
        customLocations: data.custom_locations ?? [],
        lastCityId: data.last_city_id ?? null,
        history: (data.history as DayRecord[]) ?? [],
      },
    };
  }

  // Profile doesn't exist yet — create from localStorage
  const prefs = loadPreferences();
  const favs = loadFavorites();
  const custom = loadCustomLocations();
  const profile: UserProfile = {
    id: user.id,
    email: user.email || "",
    skinType: prefs.skinType ?? 3,
    areaFraction: prefs.areaFraction ?? 0.25,
    age: prefs.age ?? null,
    threshold: prefs.threshold,
    favorites: favs,
    customLocations: custom,
    lastCityId: prefs.lastCityId ?? null,
    history: loadHistory(),
  };

  await saveProfile(profile);
  return { profile, isLoggedIn: true };
}

// Save profile: to Supabase if logged in, always to localStorage
export async function saveProfile(profile: UserProfile): Promise<void> {
  // Always save to localStorage as cache
  savePreferences({
    threshold: profile.threshold,
    lastCityId: profile.lastCityId ?? undefined,
    skinType: profile.skinType,
    areaFraction: profile.areaFraction,
    age: profile.age ?? undefined,
  });
  saveFavorites(profile.favorites);
  // Custom locations
  for (const c of profile.customLocations) {
    saveCustomLocation(c);
  }

  const sb = getSupabase();
  if (!sb) return;

  await sb.from("profiles").upsert({
    id: profile.id,
    skin_type: profile.skinType,
    area_fraction: profile.areaFraction,
    age: profile.age,
    threshold: profile.threshold,
    favorites: profile.favorites,
    custom_locations: profile.customLocations,
    last_city_id: profile.lastCityId,
    history: profile.history,
    updated_at: new Date().toISOString(),
  });

  saveHistory(profile.history);
}

// Partial update
export async function updateProfile(id: string, updates: Partial<Omit<UserProfile, "id" | "email">>): Promise<void> {
  // Update localStorage
  const prefs = loadPreferences();
  if (updates.threshold !== undefined) prefs.threshold = updates.threshold;
  if (updates.skinType !== undefined) prefs.skinType = updates.skinType;
  if (updates.areaFraction !== undefined) prefs.areaFraction = updates.areaFraction;
  if (updates.age !== undefined) prefs.age = updates.age ?? undefined;
  if (updates.lastCityId !== undefined) prefs.lastCityId = updates.lastCityId ?? undefined;
  savePreferences(prefs);

  if (updates.favorites) saveFavorites(updates.favorites);
  if (updates.history) saveHistory(updates.history);

  const sb = getSupabase();
  if (!sb) return;

  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.threshold !== undefined) dbUpdates.threshold = updates.threshold;
  if (updates.skinType !== undefined) dbUpdates.skin_type = updates.skinType;
  if (updates.areaFraction !== undefined) dbUpdates.area_fraction = updates.areaFraction;
  if (updates.age !== undefined) dbUpdates.age = updates.age;
  if (updates.favorites !== undefined) dbUpdates.favorites = updates.favorites;
  if (updates.customLocations !== undefined) dbUpdates.custom_locations = updates.customLocations;
  if (updates.lastCityId !== undefined) dbUpdates.last_city_id = updates.lastCityId;
  if (updates.history !== undefined) dbUpdates.history = updates.history;

  await sb.from("profiles").update(dbUpdates).eq("id", id);
}
