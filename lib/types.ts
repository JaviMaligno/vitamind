export type CitySource = "builtin" | "geonames" | "nominatim" | "custom";

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tz: number;
  country?: string;
  flag?: string;
  population?: number;
  source: CitySource;
}

export interface SolarPoint {
  localHours: number;
  elevation: number;
}

export interface VitDWindow {
  start: number;
  end: number;
  peak: number;
}

export interface HoverInfo {
  lat: number;
  lon: number;
  name: string;
  snap: City | null;
}

export interface WeatherHour {
  time: string;
  uvIndex: number;
  cloudCover: number;
}

export interface WeatherData {
  hours: WeatherHour[];
  fetchedAt: number;
}

export interface Preferences {
  threshold: number;
  lastCityId?: string;
  skinType?: 1 | 2 | 3 | 4 | 5 | 6;
  areaFraction?: number;
  age?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  skinType: 1 | 2 | 3 | 4 | 5 | 6;
  areaFraction: number;
  age: number | null;
  threshold: number;
  favorites: string[];
  customLocations: City[];
  lastCityId: string | null;
}

export interface DayRecord {
  date: string;            // "2026-03-14" ISO date
  cityId: string;          // user's city that day
  peakUVI: number;         // actual peak UVI from Open-Meteo
  windowStart: number;     // hour (e.g., 12.5 = 12:30)
  windowEnd: number;       // hour
  minutesNeeded: number;   // based on user profile
  sufficient: boolean;     // conditions met for synthesis?
  userOverride: boolean | null; // null = not edited, true/false = user corrected
}
