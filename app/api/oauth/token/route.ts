import { NextRequest, NextResponse } from "next/server";
import { getOAuthDb, exchangeAuthCode, refreshTokens, OAuthError } from "@/lib/oauth";

/** OAuth 2.1 token endpoint: authorization_code (PKCE) + refresh_token grants. */
export async function POST(request: NextRequest) {
  const db = getOAuthDb();
  if (!db) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });

  let form: URLSearchParams;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      form = new URLSearchParams(Object.entries((await request.json()) as Record<string, string>));
    } else {
      form = new URLSearchParams(await request.text());
    }
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const grantType = form.get("grant_type");
  try {
    if (grantType === "authorization_code") {
      const tokens = await exchangeAuthCode(db, {
        code: form.get("code") ?? "",
        codeVerifier: form.get("code_verifier") ?? "",
        clientId: form.get("client_id") ?? "",
        redirectUri: form.get("redirect_uri") ?? "",
      });
      return NextResponse.json(tokens, { headers: { "Cache-Control": "no-store" } });
    }
    if (grantType === "refresh_token") {
      const tokens = await refreshTokens(db, {
        refreshToken: form.get("refresh_token") ?? "",
        clientId: form.get("client_id") ?? "",
      });
      return NextResponse.json(tokens, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (err) {
    if (err instanceof OAuthError) {
      return NextResponse.json({ error: err.code, error_description: err.message }, { status: 400 });
    }
    console.error("[api/oauth/token] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
