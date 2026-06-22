import { NextRequest, NextResponse } from "next/server";
import { saveSubscription, removeSubscription, updateSubscriptionLocale } from "@/lib/push-store";

const SUPPORTED_LOCALES = ["es", "en", "fr", "de", "ru", "lt"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, lat, lon, tz, timezone, skinType, areaFraction, cityName, locale } = body;

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await saveSubscription({
      subscription,
      lat: lat ?? 0,
      lon: lon ?? 0,
      tz: tz ?? 0,
      timezone: timezone ?? undefined,
      skinType: skinType ?? 3,
      areaFraction: areaFraction ?? 0.25,
      cityName: cityName ?? "",
      locale: SUPPORTED_LOCALES.includes(locale) ? locale : "es",
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to save subscription", detail: message },
      { status: 500 },
    );
  }
}

// Lightweight locale-only update. Lets the app correct a stale subscription
// language on any page load without re-sending (and risking clobbering) the
// rest of the stored preferences.
export async function PATCH(request: NextRequest) {
  try {
    const { endpoint, locale } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    if (!SUPPORTED_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "unsupported locale" }, { status: 400 });
    }
    await updateSubscriptionLocale(endpoint, locale);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to update locale", detail: message },
      { status: 500 },
    );
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to remove subscription", detail: message },
      { status: 500 },
    );
  }
}
