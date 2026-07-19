import { NextRequest, NextResponse } from "next/server";
import { getOAuthDb, registerClient, OAuthError } from "@/lib/oauth";

/** RFC 7591 dynamic client registration — open, public clients only (PKCE). */
export async function POST(request: NextRequest) {
  const db = getOAuthDb();
  if (!db) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }

  try {
    const client = await registerClient(db, body as Record<string, unknown>);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    if (err instanceof OAuthError) {
      return NextResponse.json({ error: err.code, error_description: err.message }, { status: 400 });
    }
    console.error("[api/oauth/register] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
