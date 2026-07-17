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
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({
        hourly: { time: ["2026-07-16T12:00"], uv_index: [7.5], cloud_cover: [10] },
      })),
    );
    const res = await GET(request("lat=40.4&lon=-3.7"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hours).toEqual([{ time: "2026-07-16T12:00", uvIndex: 7.5, cloudCover: 10 }]);
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
