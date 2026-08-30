import { NextRequest, NextResponse } from "next/server";
import { parsePayload } from "@/lib/analytics-ingest";
import { insertEvents } from "@/lib/analytics-store";

/**
 * Analytics ingest.
 *
 * Public and unauthenticated by necessity — the events come from browsers. All
 * validation lives in `lib/analytics-ingest.ts`, which is pure and tested on its
 * own; this file is the transport and nothing more.
 *
 * Every response is empty. The client sends these with `navigator.sendBeacon`,
 * which cannot read a response, so a body would be bytes nobody ever sees.
 */

/** Bigger than any honest batch: 50 events of capped size cannot approach it. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Not a security boundary — an Origin header is trivially forged — but it keeps
 * other people's pages and casual scripts out of a table whose only value is
 * that its numbers correspond to real visits. Beacons on some browsers send no
 * Origin at all, so a missing header is allowed; a *wrong* one is not.
 */
function isOwnOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isOwnOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const payload = parsePayload(body, new Date());
  if (!payload) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    await insertEvents(payload);
  } catch (err: unknown) {
    // Logged, never swallowed: a store that fails quietly is how two outages
    // here lasted ~50 days each. The visitor's page is unaffected either way.
    console.error("[api/events] insert failed:", err);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
