import { describe, expect, it } from "vitest";
import { endpointFor, rangeUrl, hoursFromPayload, ARCHIVE_URL, FORECAST_URL } from "../weather-range";

const NOW = new Date("2026-08-02T10:00:00Z");

describe("endpointFor", () => {
  it("asks the forecast host for anything within its window", () => {
    expect(endpointFor("2026-08-01", NOW)).toBe(FORECAST_URL);
    // A fortnight back used to go to the archive, which has no UV at all.
    expect(endpointFor("2026-07-23", NOW)).toBe(FORECAST_URL);
    expect(endpointFor("2026-06-01", NOW)).toBe(FORECAST_URL);
  });

  it("asks the archive only for what the forecast will not accept", () => {
    expect(endpointFor("2026-02-14", NOW)).toBe(ARCHIVE_URL);
  });

  it("puts the boundary at the documented 92 days", () => {
    expect(endpointFor("2026-05-02", NOW)).toBe(FORECAST_URL);
    expect(endpointFor("2026-05-01", NOW)).toBe(ARCHIVE_URL);
  });
});

describe("rangeUrl", () => {
  it("asks for the hours the exposure model needs", () => {
    const url = new URL(rangeUrl(51.56, -0.1, "2026-07-21", "2026-07-26", NOW));
    expect(url.origin + url.pathname).toBe(FORECAST_URL);
    expect(url.searchParams.get("hourly")).toBe("uv_index,cloud_cover");
    expect(url.searchParams.get("start_date")).toBe("2026-07-21");
    expect(url.searchParams.get("end_date")).toBe("2026-07-26");
    // Local time, so an hour string lines up with the day it belongs to.
    expect(url.searchParams.get("timezone")).toBe("auto");
  });
});

describe("hoursFromPayload", () => {
  it("flattens the parallel arrays Open-Meteo returns", () => {
    const hours = hoursFromPayload({
      hourly: { time: ["2026-07-23T10:00", "2026-07-23T11:00"], uv_index: [3.1, 3.8], cloud_cover: [95, 96] },
    });
    expect(hours).toEqual([
      { time: "2026-07-23T10:00", uvIndex: 3.1, cloudCover: 95 },
      { time: "2026-07-23T11:00", uvIndex: 3.8, cloudCover: 96 },
    ]);
  });

  it("drops an hour with no UV reading instead of calling it zero", () => {
    // Zero says the sun was not up. The caller has to be able to tell that from
    // "nobody measured", because it falls back to the clear-sky model on one and
    // reports darkness on the other.
    const hours = hoursFromPayload({
      hourly: { time: ["2026-07-23T10:00", "2026-07-23T11:00"], uv_index: [null, 3.8], cloud_cover: [95, 96] },
    });
    expect(hours).toEqual([{ time: "2026-07-23T11:00", uvIndex: 3.8, cloudCover: 96 }]);
  });

  it("still keeps an hour whose cloud cover is missing", () => {
    // The UV already carries the attenuation, so a gap there costs nothing.
    const hours = hoursFromPayload({ hourly: { time: ["2026-07-23T11:00"], uv_index: [3.8], cloud_cover: [] } });
    expect(hours).toEqual([{ time: "2026-07-23T11:00", uvIndex: 3.8, cloudCover: 0 }]);
  });

  it("refuses an archive payload, which carries cloud cover but no UV", () => {
    // Exactly what archive-api returns: `uv_index` present and null throughout.
    expect(hoursFromPayload({
      hourly: { time: ["2026-07-12T10:00", "2026-07-12T11:00"], uv_index: [null, null], cloud_cover: [40, 45] },
    })).toBeNull();
  });

  it("refuses a payload with no hours at all", () => {
    expect(hoursFromPayload({ hourly: {} })).toBeNull();
    expect(hoursFromPayload({ error: true, reason: "nope" })).toBeNull();
    expect(hoursFromPayload(null)).toBeNull();
  });
});
