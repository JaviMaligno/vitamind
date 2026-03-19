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

// Favorites
export function loadFavorites(): string[] {
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
  return getItem<Preferences>(KEYS.preferences, { threshold: 50 });
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
