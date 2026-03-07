import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("hourly", "uv_index,cloud_cover");
    url.searchParams.set("forecast_days", "3");
    if (date) {
      url.searchParams.set("start_date", date);
      url.searchParams.set("end_date", date);
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({ error: "Open-Meteo API error", status: res.status, detail: body.slice(0, 200) }, { status: 502 });
    }

    const data = await res.json();

    if (!data.hourly?.time) {
      return NextResponse.json({ error: "No hourly data" }, { status: 502 });
    }

    const hours = data.hourly.time.map((t: string, i: number) => ({
      time: t,
      uvIndex: data.hourly.uv_index?.[i] ?? 0,
      cloudCover: data.hourly.cloud_cover?.[i] ?? 0,
    }));

    return NextResponse.json({ hours }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
