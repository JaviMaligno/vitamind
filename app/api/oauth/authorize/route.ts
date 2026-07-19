import { NextRequest, NextResponse } from "next/server";
import { getOAuthDb, validateAuthorizeRequest, OAuthError } from "@/lib/oauth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * OAuth 2.1 authorization endpoint. Validates the request and hands the user
 * to the in-app consent page (default-locale path, no prefix), which performs
 * Supabase login + approval and then calls /api/oauth/approve.
 *
 * Per spec: never redirect to an unvalidated redirect_uri — client/redirect
 * problems return 400 here; only post-validation errors go back via redirect.
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(`authorize:${clientIp(request)}`, 60, 10 * 60 * 1000)) {
    return new NextResponse("rate limited", { status: 429 });
  }
  const db = getOAuthDb();
  if (!db) return new NextResponse("temporarily unavailable", { status: 503 });

  const q = request.nextUrl.searchParams;
  const params = {
    client_id: q.get("client_id") ?? "",
    redirect_uri: q.get("redirect_uri") ?? "",
    response_type: q.get("response_type") ?? "",
    scope: q.get("scope") ?? undefined,
    code_challenge: q.get("code_challenge") ?? undefined,
    code_challenge_method: q.get("code_challenge_method") ?? undefined,
  };
  const state = q.get("state") ?? "";

  try {
    await validateAuthorizeRequest(db, params);
  } catch (err) {
    if (err instanceof OAuthError) {
      if (err.code === "invalid_client" || err.code === "invalid_redirect_uri") {
        return new NextResponse(`${err.code}: ${err.message}`, { status: 400 });
      }
      const back = new URL(params.redirect_uri);
      back.searchParams.set("error", err.code);
      back.searchParams.set("error_description", err.message);
      if (state) back.searchParams.set("state", state);
      return NextResponse.redirect(back);
    }
    console.error("[api/oauth/authorize] failed:", err);
    return new NextResponse("server error", { status: 500 });
  }

  const consent = request.nextUrl.clone();
  consent.pathname = "/oauth-consent";
  consent.search = "";
  for (const [k, v] of q.entries()) consent.searchParams.set(k, v);
  return NextResponse.redirect(consent);
}
