import { NextRequest, NextResponse } from "next/server";
import { endpointFor, hoursFromPayload, FORECAST_URL } from "@/lib/weather-range";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPSTREAM_TIMEOUT_MS = 8000;

function parseCoord(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseCoord(searchParams.get("lat"), -90, 90);
  const lon = parseCoord(searchParams.get("lon"), -180, 180);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const days = searchParams.get("days");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  }
  for (const d of [date, start, end]) {
    if (d && !DATE_RE.test(d)) {
      return NextResponse.json({ error: "dates must be YYYY-MM-DD" }, { status: 400 });
    }
  }

  try {
    // Which host carries the requested dates is decided in lib/weather-range.ts,
    // so the MCP server reconstructing a past day applies the same rule.
    const startDate = start || date || null;
    const url = new URL(startDate ? endpointFor(startDate) : FORECAST_URL);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("hourly", "uv_index,cloud_cover");
    url.searchParams.set("timezone", "auto");
    if (start && end) {
      url.searchParams.set("start_date", start);
      url.searchParams.set("end_date", end);
    } else if (date) {
      url.searchParams.set("start_date", date);
      url.searchParams.set("end_date", date);
    } else if (days) {
      const nDays = Math.min(Math.max(parseInt(days, 10) || 3, 1), 16);
      url.searchParams.set("forecast_days", String(nDays));
    } else {
      url.searchParams.set("forecast_days", "3");
    }

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[api/weather] Open-Meteo ${res.status} for lat=${lat} lon=${lon}: ${body.slice(0, 300)}`);
      return NextResponse.json({ error: "Upstream weather service error" }, { status: 502 });
    }

    const hours = hoursFromPayload(await res.json());

    if (!hours) {
      console.error(`[api/weather] Open-Meteo returned no hourly data for lat=${lat} lon=${lon}`);
      return NextResponse.json({ error: "No hourly data" }, { status: 502 });
    }

    return NextResponse.json({ hours }, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err: unknown) {
    console.error("[api/weather] failed:", err);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
