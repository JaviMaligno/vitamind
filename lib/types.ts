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
}
