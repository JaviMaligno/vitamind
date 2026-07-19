import { NextRequest, NextResponse } from "next/server";
import { getOAuthDb, userIdFromSupabaseJwt } from "@/lib/oauth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * The signed-in user's live AI connections, for the profile's revocation UI.
 * Auth: the user's Supabase session JWT (same pattern as /api/oauth/approve).
 */

async function authedUser(request: NextRequest): Promise<string | null> {
  const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  return userIdFromSupabaseJwt(jwt);
}

export async function GET(request: NextRequest) {
  if (!rateLimit(`connections:${clientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const db = getOAuthDb();
  if (!db) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });

  const userId = await authedUser(request);
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  try {
    return NextResponse.json({ connections: await db.listConnections(userId) });
  } catch (err) {
    console.error("[api/oauth/connections] list failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!rateLimit(`connections:${clientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const db = getOAuthDb();
  if (!db) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });

  const userId = await authedUser(request);
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const revoked = await db.revokeClientTokens(userId, clientId);
    return NextResponse.json({ revoked });
  } catch (err) {
    console.error("[api/oauth/connections] revoke failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
