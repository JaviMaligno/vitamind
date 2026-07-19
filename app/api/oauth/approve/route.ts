import { NextRequest, NextResponse } from "next/server";
import {
  getOAuthDb, validateAuthorizeRequest, createAuthCode, userIdFromSupabaseJwt, OAuthError,
} from "@/lib/oauth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Called by the consent page after the user clicks "allow". Proves the user
 * with their Supabase session JWT (Authorization header), re-validates the
 * authorize params server-side, mints the single-use code and returns the
 * redirect URL for the page to navigate to.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`approve:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const db = getOAuthDb();
  if (!db) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });

  const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const userId = await userIdFromSupabaseJwt(jwt);
  if (!userId) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let body: {
    client_id?: string; redirect_uri?: string; scope?: string; state?: string;
    code_challenge?: string; code_challenge_method?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const { scopes } = await validateAuthorizeRequest(db, {
      client_id: body.client_id ?? "",
      redirect_uri: body.redirect_uri ?? "",
      response_type: "code",
      scope: body.scope,
      code_challenge: body.code_challenge,
      code_challenge_method: body.code_challenge_method,
    });

    const code = await createAuthCode(db, {
      clientId: body.client_id!,
      userId,
      redirectUri: body.redirect_uri!,
      scopes,
      codeChallenge: body.code_challenge!,
    });

    const redirect = new URL(body.redirect_uri!);
    redirect.searchParams.set("code", code);
    if (body.state) redirect.searchParams.set("state", body.state);
    return NextResponse.json({ redirect: redirect.toString() });
  } catch (err) {
    if (err instanceof OAuthError) {
      return NextResponse.json({ error: err.code, error_description: err.message }, { status: 400 });
    }
    console.error("[api/oauth/approve] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
