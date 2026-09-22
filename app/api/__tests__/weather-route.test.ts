import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/weather/route";

const realFetch = global.fetch;

function request(qs: string) {
  return new NextRequest(`http://localhost/api/weather?${qs}`);
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = realFetch;
});

describe("/api/weather input validation", () => {
  it.each([
    ["missing coords", ""],
    ["out-of-range lat", "lat=91&lon=0"],
    ["out-of-range lon", "lat=0&lon=181"],
    ["non-numeric lat", "lat=abc&lon=0"],
    ["malformed date", "lat=40&lon=-3&date=20-July-2026"],
  ])("rejects %s with 400 and no upstream call", async (_name, qs) => {
    const res = await GET(request(qs));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("/api/weather upstream handling", () => {
  it("maps hourly data through on success", async () => {
    // A fresh Response per call: a forecast request now makes two (the second
    // is the five-model irradiance, lib/cloud-transmission.ts), and a body can
    // only be read once.
    vi.mocked(global.fetch).mockImplementation(async () =>
      new Response(JSON.stringify({
        hourly: { time: ["2026-07-16T12:00"], uv_index: [7.5], cloud_cover: [10] },
      })),
    );
    const res = await GET(request("lat=40.4&lon=-3.7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hours).toEqual([{ time: "2026-07-16T12:00", uvIndex: 7.5, uvIndexClearSky: null, cloudCover: 10 }]);
  });

  it("takes a forecast's cloud from the five-model irradiance median", async () => {
    // Madrid, 16 July, 13:00 local (11:00 UTC; hour centre 10:30 UTC, sun ~64°,
    // clear-sky GHI ~930 W/m²). Open-Meteo alone says heavy cloud; the five
    // models say half the clear sky gets through.
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const u = new URL(String(input));
      if (u.searchParams.get("models")) {
        return new Response(JSON.stringify({
          utc_offset_seconds: 7200,
          hourly: {
            time: ["2026-07-16T13:00"],
            shortwave_radiation_ukmo_seamless: [465], shortwave_radiation_meteofrance_seamless: [465],
            shortwave_radiation_ecmwf_ifs025: [465], shortwave_radiation_icon_seamless: [100],
            shortwave_radiation_gfs_seamless: [900],
          },
        }));
      }
      return new Response(JSON.stringify({
        hourly: { time: ["2026-07-16T13:00"], uv_index: [1], uv_index_clear_sky: [9], cloud_cover: [95] },
      }));
    });
    const body = await (await GET(request("lat=40.42&lon=-3.70"))).json();
    const [h] = body.hours;
    expect(h.cloudTransmission).toBeGreaterThan(0.45);
    expect(h.cloudTransmission).toBeLessThan(0.55);
    expect(h.uvIndex).toBeCloseTo(9 * h.cloudTransmission, 6);
  });

  it("answers exactly as before when the irradiance request fails", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) =>
      new URL(String(input)).searchParams.get("models")
        ? new Response("boom", { status: 500 })
        : new Response(JSON.stringify({ hourly: { time: ["2026-07-16T13:00"], uv_index: [1], uv_index_clear_sky: [9], cloud_cover: [95] } })),
    );
    const body = await (await GET(request("lat=40.42&lon=-3.70"))).json();
    expect(body.hours).toEqual([{ time: "2026-07-16T13:00", uvIndex: 1, uvIndexClearSky: 9, cloudCover: 95 }]);
  });

  it("leaves history ranges on Open-Meteo's own UV, with no second request", async () => {
    vi.mocked(global.fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ hourly: { time: ["2026-07-16T13:00"], uv_index: [1], uv_index_clear_sky: [9], cloud_cover: [95] } })),
    );
    await GET(request("lat=40.42&lon=-3.70&start=2026-07-10&end=2026-07-16"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns 502 without leaking the upstream body when Open-Meteo fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("internal quota exceeded for key XYZ", { status: 429 }),
    );
    const res = await GET(request("lat=40&lon=-3"));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("XYZ");
  });

  it("returns 500 when the upstream call throws (e.g. timeout)", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("aborted by AbortSignal.timeout"));
    const res = await GET(request("lat=40&lon=-3"));
    expect(res.status).toBe(500);
  });

  it("clamps forecast days into Open-Meteo's supported range", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ hourly: { time: [] } })),
    );
    await GET(request("lat=40&lon=-3&days=999"));
    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("forecast_days=16");
  });
});
