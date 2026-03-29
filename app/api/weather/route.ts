import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const days = searchParams.get("days");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  try {
    // Decide whether to use archive or forecast endpoint
    // Open-Meteo forecast only has ~7 days of past data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const startDate = start || date || null;
    const needsArchive = startDate && new Date(startDate + "T00:00:00") < sevenDaysAgo;

    const baseUrl = needsArchive
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";

    const url = new URL(baseUrl);
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("hourly", "uv_index,cloud_cover");
    url.searchParams.set("timezone", "auto");
    if (start && end) {
      url.searchParams.set("start_date", start);
      url.searchParams.set("end_date", end);
    } else if (date) {
      url.searchParams.set("start_date", date);
      url.searchParams.set("end_date", date);
    } else if (days) {
      url.searchParams.set("forecast_days", days);
    } else {
      url.searchParams.set("forecast_days", "3");
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
