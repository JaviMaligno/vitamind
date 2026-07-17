import { NextRequest, NextResponse } from "next/server";
import { saveSubscription, removeSubscription, updateSubscriptionLocale } from "@/lib/push-store";

const SUPPORTED_LOCALES = ["es", "en", "fr", "de", "ru", "lt"];
const MAX_ENDPOINT_LENGTH = 1024;
const MAX_CITY_NAME_LENGTH = 120;

/** Push endpoints are opaque https URLs issued by the browser's push service. */
function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, lat, lon, tz, timezone, skinType, areaFraction, cityName, locale } = body;

    if (!isValidEndpoint(subscription?.endpoint)) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await saveSubscription({
      subscription,
      lat: clamp(lat, -90, 90, 0),
      lon: clamp(lon, -180, 180, 0),
      tz: clamp(tz, -12, 14, 0),
      timezone: typeof timezone === "string" ? timezone.slice(0, 64) : undefined,
      skinType: clamp(skinType, 1, 6, 3),
      areaFraction: clamp(areaFraction, 0.01, 1, 0.25),
      cityName: typeof cityName === "string" ? cityName.slice(0, MAX_CITY_NAME_LENGTH) : "",
      locale: SUPPORTED_LOCALES.includes(locale) ? locale : "es",
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[api/push/subscribe] POST failed:", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

// Lightweight locale-only update. Lets the app correct a stale subscription
// language on any page load without re-sending (and risking clobbering) the
// rest of the stored preferences.
export async function PATCH(request: NextRequest) {
  try {
    const { endpoint, locale } = await request.json();
    if (!isValidEndpoint(endpoint)) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    if (!SUPPORTED_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "unsupported locale" }, { status: 400 });
    }
    await updateSubscriptionLocale(endpoint, locale);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[api/push/subscribe] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update locale" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    if (!isValidEndpoint(endpoint)) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[api/push/subscribe] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
