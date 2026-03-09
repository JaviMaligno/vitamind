import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const headers = {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
  };

  try {
    // Proximity search: GET /api/cities?lat=X&lon=Y&limit=N
    if (latParam && lonParam) {
      const lat = parseFloat(latParam);
      const lon = parseFloat(lonParam);

      if (isNaN(lat) || isNaN(lon)) {
        return NextResponse.json(
          { error: "Invalid lat/lon" },
          { status: 400 }
        );
      }

      // Try RPC first (search_cities_nearby function)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "search_cities_nearby",
        { p_lat: lat, p_lon: lon, p_limit: limit }
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        return NextResponse.json(rpcData, { headers });
      }

      // Fallback: simple range query (±2 degrees)
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .gte("lat", lat - 2)
        .lte("lat", lat + 2)
        .gte("lon", lon - 2)
        .lte("lon", lon + 2)
        .order("population", { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? [], { headers });
    }

    // Name search: GET /api/cities?q=ecija&limit=10
    if (q && q.length >= 2) {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .ilike("ascii_name", `%${q}%`)
        .order("population", { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? [], { headers });
    }

    return NextResponse.json(
      { error: "Provide ?q= or ?lat=&lon= parameters" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
