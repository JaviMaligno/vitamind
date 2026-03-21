import { NextRequest, NextResponse } from "next/server";
import { saveSubscription, removeSubscription } from "@/lib/push-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, lat, lon, tz, skinType, areaFraction, cityName } = body;

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await saveSubscription({
      subscription,
      lat: lat ?? 0,
      lon: lon ?? 0,
      tz: tz ?? 0,
      skinType: skinType ?? 3,
      areaFraction: areaFraction ?? 0.25,
      cityName: cityName ?? "",
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
