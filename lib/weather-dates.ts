// Open-Meteo's 16 forecast days include today (UTC): today through today + 15.
// Shared by the API and Explore so unsupported dates never reach the provider.
export const FORECAST_DAYS = 16;

export function isWeatherDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1940-01-01") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Date.parse normalizes e.g. February 30, so check the calendar day round trip.
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function lastForecastDate(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    + (FORECAST_DAYS - 1) * 86400000).toISOString().slice(0, 10);
}

/** Historical dates remain eligible for the archive; only the future is capped. */
export function canRequestWeatherDate(value: string, now: Date = new Date()): boolean {
  return isWeatherDate(value) && value <= lastForecastDate(now);
}
