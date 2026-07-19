import type { City, Preferences, WeatherData, DayRecord } from "./types";
import { DEFAULT_FAVORITE_IDS } from "./cities";

const KEYS = {
  favorites: "vitamind:favorites",
  customLocations: "vitamind:customLocations",
  preferences: "vitamind:preferences",
  weatherCache: "vitamind:weather",
  history: "vitamind:history",
} as const;

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full — silently ignore */ }
}

// One-time cleanup of the legacy auto-seeded favorites. The original prototype
// (docs/original_claude_ouput/vitamin-d-global-v5.jsx) shipped a hardcoded
// DEFAULT_FAVS list that got persisted to localStorage for early users. The app
// now starts with no favorites (DEFAULT_FAVORITE_IDS = []), but those early
// users were left with 10 cities they never chose. Clear them once — but ONLY
// when the stored set is EXACTLY that old default, so anyone who has since
// curated their own list is left untouched.
const LEGACY_DEFAULT_FAVORITE_IDS = [
  "builtin:londres", "builtin:madrid", "builtin:estocolmo", "builtin:nueva-york",
  "builtin:tokio", "builtin:nairobi", "builtin:sidney", "builtin:bogota",
  "builtin:reikiavik", "builtin:ciudad-del-cabo",
];
const LEGACY_FAV_MIGRATION_KEY = "vitamind:legacyFavMigration";

function migrateLegacyFavorites(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LEGACY_FAV_MIGRATION_KEY)) return;
    const raw = localStorage.getItem(KEYS.favorites);
    if (raw) {
      const stored = JSON.parse(raw);
      const isExactLegacyDefault =
        Array.isArray(stored) &&
        stored.length === LEGACY_DEFAULT_FAVORITE_IDS.length &&
        LEGACY_DEFAULT_FAVORITE_IDS.every((id) => stored.includes(id));
      if (isExactLegacyDefault) {
        localStorage.setItem(KEYS.favorites, JSON.stringify([]));
      }
    }
    // Mark done regardless, so a user who later re-creates exactly these 10 on
    // purpose is never second-guessed by this migration.
    localStorage.setItem(LEGACY_FAV_MIGRATION_KEY, "1");
  } catch { /* ignore corrupt storage */ }
}

// Favorites
export function loadFavorites(): string[] {
  migrateLegacyFavorites();
  return getItem<string[]>(KEYS.favorites, DEFAULT_FAVORITE_IDS);
}

export function saveFavorites(ids: string[]): void {
  setItem(KEYS.favorites, ids);
}

// Custom locations
export function loadCustomLocations(): City[] {
  return getItem<City[]>(KEYS.customLocations, []);
}

export function saveCustomLocation(city: City): void {
  const existing = loadCustomLocations();
  const updated = existing.filter((c) => c.id !== city.id);
  updated.push(city);
  setItem(KEYS.customLocations, updated);
}

export function deleteCustomLocation(id: string): void {
  const existing = loadCustomLocations();
  setItem(KEYS.customLocations, existing.filter((c) => c.id !== id));
}

// Preferences
export function loadPreferences(): Preferences {
  return getItem<Preferences>(KEYS.preferences, { threshold: 45 });
}

export function savePreferences(prefs: Preferences): void {
  setItem(KEYS.preferences, prefs);
}

// Weather cache
export function getCachedWeather(lat: number, lon: number, date: string): WeatherData | null {
  const key = `${KEYS.weatherCache}:${lat.toFixed(2)}:${lon.toFixed(2)}:${date}`;
  const data = getItem<WeatherData | null>(key, null);
  if (!data) return null;
  const age = Date.now() - data.fetchedAt;
  if (age > 3 * 60 * 60 * 1000) return null; // TTL 3 hours
  return data;
}

export function setCachedWeather(lat: number, lon: number, date: string, data: WeatherData): void {
  const key = `${KEYS.weatherCache}:${lat.toFixed(2)}:${lon.toFixed(2)}:${date}`;
  setItem(key, data);
}

const MAX_HISTORY_DAYS = 90;

// History
export function loadHistory(): DayRecord[] {
  return getItem<DayRecord[]>(KEYS.history, []);
}

export function saveHistory(records: DayRecord[]): void {
  const sorted = records
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_HISTORY_DAYS);
  setItem(KEYS.history, sorted);
}

export function upsertDayRecord(record: DayRecord): void {
  const records = loadHistory();
  const idx = records.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    const existing = records[idx];
    records[idx] = {
      ...record,
      userOverride: record.userOverride ?? existing.userOverride,
    };
  } else {
    records.push(record);
  }
  saveHistory(records);
}

export function toggleDayOverride(date: string): void {
  const records = loadHistory();
  const record = records.find((r) => r.date === date);
  if (!record) return;

  // Only allow toggling on favorable days
  if (!record.sufficient) return;

  // 2-state toggle: null (unconfirmed) ↔ true (confirmed went out)
  record.userOverride = record.userOverride === true ? null : true;
  saveHistory(records);
}

export function mergeHistory(local: DayRecord[], remote: DayRecord[]): DayRecord[] {
  const map = new Map<string, DayRecord>();
  for (const r of local) map.set(r.date, r);
  for (const r of remote) map.set(r.date, r); // remote wins
  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
}
