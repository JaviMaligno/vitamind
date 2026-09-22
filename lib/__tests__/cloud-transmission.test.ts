import { describe, it, expect } from "vitest";
import {
  CLOUD_MODELS,
  clearSkyGHI,
  transmissionFromPayload,
  forecastHours,
  radiationUrl,
} from "@/lib/cloud-transmission";
import { hoursFromPayload } from "@/lib/weather-range";
import { getCurrentStatus, MIN_UVI } from "@/lib/vitd";
import { getCurve, doyFromMonthDay } from "@/lib/solar";
import { ozoneColumn } from "@/lib/uv-model";
import london from "./fixtures/london-2026-09-22-forecast.json";

/**
 * WHY THIS MODULE EXISTS.
 *
 * On 2026-09-22 a reader in London under a clear sky was told there was no
 * vitamin D window. Nothing in our code was wrong: Open-Meteo's `best_match`
 * (the UK Met Office model, in the UK) forecast 61-89% cloud and a UV peak of
 * 2.75. Heathrow reported no significant cloud; the satellite measured 511 W/m²
 * at 13:00 against the 429 that model forecast.
 *
 * Measured afterwards against ground stations (10 DWD in Germany, 5 NOAA
 * SURFRAD in the US, one year, day-ahead): the MEDIAN of five models' forecast
 * irradiance beats every single model, `best_match` included, on both
 * continents — and the UV that cloud lets through tracks that irradiance ratio
 * almost exactly (measured UVB, fitted exponent 1.04). docs/cloud-forecast.md
 * has the numbers.
 */

const LAT = 51.51, LON = -0.13;
const at = <T extends { time: string }>(hours: T[], hhmm: string) => hours.find((h) => h.time.endsWith(hhmm));

describe("clearSkyGHI", () => {
  it("is zero with the sun at or below the horizon, and grows with it", () => {
    expect(clearSkyGHI(0)).toBe(0);
    expect(clearSkyGHI(-5)).toBe(0);
    expect(clearSkyGHI(30)).toBeGreaterThan(clearSkyGHI(20));
    expect(clearSkyGHI(90)).toBeGreaterThan(1000);
  });
});

describe("transmissionFromPayload", () => {
  const payload = (row: (number | null)[], time = "2026-06-21T13:00") => ({
    utc_offset_seconds: 0,
    hourly: {
      time: [time],
      ...Object.fromEntries(CLOUD_MODELS.map((m, i) => [`shortwave_radiation_${m}`, [row[i]]])),
    },
  });

  it("takes the median across models, not the mean", () => {
    // London noon at midsummer: clear-sky GHI is ~880 W/m². One wild model must
    // not drag the answer — that is the whole case for the median.
    const t = transmissionFromPayload(payload([0, 440, 440, 440, 1000]), LAT, LON)!;
    expect(t.get("2026-06-21T13:00")).toBeCloseTo(440 / clearSkyGHI(61.4), 1);
  });

  it("ignores a model that returned nothing, and gives up below three", () => {
    const two = transmissionFromPayload(payload([500, 500, null, null, null]), LAT, LON)!;
    expect(two.has("2026-06-21T13:00")).toBe(false);
    const three = transmissionFromPayload(payload([500, 500, 500, null, null]), LAT, LON)!;
    expect(three.has("2026-06-21T13:00")).toBe(true);
  });

  it("never reports more UV than a clear sky", () => {
    const t = transmissionFromPayload(payload([2000, 2000, 2000, 2000, 2000]), LAT, LON)!;
    expect(t.get("2026-06-21T13:00")).toBe(1);
  });

  it("says nothing when the sun is too low for the ratio to mean anything", () => {
    const t = transmissionFromPayload(payload([10, 10, 10, 10, 10], "2026-12-21T09:00"), LAT, LON)!;
    expect(t.has("2026-12-21T09:00")).toBe(false);
  });

  it("returns null for a payload that is not one", () => {
    expect(transmissionFromPayload(null, LAT, LON)).toBeNull();
    expect(transmissionFromPayload({ hourly: {} }, LAT, LON)).toBeNull();
  });
});

describe("London, 22 September 2026 — the day this was built for", () => {
  it("was the failing day: Open-Meteo alone never reached the threshold", () => {
    const raw = hoursFromPayload(london.uv)!;
    expect(Math.max(...raw.map((h) => h.uvIndex))).toBeLessThan(MIN_UVI);
  });

  it("with the five-model median, UV reaches the threshold from 12:00 to 15:00", () => {
    const hours = forecastHours(london.uv, london.radiation, LAT, LON)!;
    for (const hhmm of ["12:00", "13:00", "14:00", "15:00"]) {
      expect(at(hours, hhmm)!.uvIndex, hhmm).toBeGreaterThanOrEqual(MIN_UVI);
    }
    // And it stays a forecast of THEIR clear sky times the median transmission,
    // not ours: the reference is still `uv_index_clear_sky`.
    const h13 = at(hours, "13:00")!;
    expect(h13.uvIndex).toBeCloseTo(h13.uvIndexClearSky! * h13.cloudTransmission!, 6);
    expect(h13.cloudTransmission!).toBeGreaterThan(0.7);
    expect(h13.cloudTransmission!).toBeLessThan(0.9);
  });

  it("opens a window on the dashboard that Open-Meteo alone closed", () => {
    const doy = doyFromMonthDay(8, 22);
    const curve = getCurve(LAT, LON, doy, 0, "Europe/London");
    const ctx = { ozoneDu: ozoneColumn(LAT, LON, doy), elevationM: 11 };
    const noon = new Date("2026-09-22T11:30:00Z");
    const before = getCurrentStatus({ hours: hoursFromPayload(london.uv)! }, curve, 3, 0.25, 1000, null, noon, "Europe/London", ctx);
    const after = getCurrentStatus({ hours: forecastHours(london.uv, london.radiation, LAT, LON)! }, curve, 3, 0.25, 1000, null, noon, "Europe/London", ctx);
    expect(before.window).toBeNull();
    expect(after.window).not.toBeNull();
    expect(after.window!.start).toBeLessThan(13);
    expect(after.window!.end).toBeGreaterThan(14);
  });

  it("falls back to Open-Meteo unchanged when the radiation request failed", () => {
    const hours = forecastHours(london.uv, null, LAT, LON)!;
    expect(hours).toEqual(hoursFromPayload(london.uv));
  });
});

describe("radiationUrl", () => {
  it("asks the same place and dates for the five models' irradiance, and nothing else", () => {
    const base = new URL("https://api.open-meteo.com/v1/forecast");
    base.searchParams.set("latitude", "51.51");
    base.searchParams.set("longitude", "-0.13");
    base.searchParams.set("hourly", "uv_index,uv_index_clear_sky,cloud_cover");
    base.searchParams.set("timezone", "auto");
    base.searchParams.set("forecast_days", "5");
    const u = new URL(radiationUrl(base));
    expect(u.origin + u.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(u.searchParams.get("latitude")).toBe("51.51");
    expect(u.searchParams.get("forecast_days")).toBe("5");
    expect(u.searchParams.get("timezone")).toBe("auto");
    expect(u.searchParams.get("hourly")).toBe("shortwave_radiation");
    // Five series: under Open-Meteo's 10-variable line, so it costs one call.
    expect(u.searchParams.get("models")!.split(",")).toEqual([...CLOUD_MODELS]);
  });
});
