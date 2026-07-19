import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

/**
 * Minimal OAuth 2.1 authorization server for the MCP personal tools.
 * Public clients only (PKCE S256 mandatory, no client secrets), auth codes and
 * tokens stored hashed, refresh rotation on every use. Identity comes from
 * Supabase Auth: the consent page proves the user with their Supabase JWT and
 * we mint our own opaque tokens — Supabase JWTs are never accepted at the MCP
 * endpoint.
 *
 * Storage goes through the `OAuthDb` interface so the flows are unit-testable
 * with an in-memory fake; production uses the service-role Supabase client.
 */

export const OAUTH_SCOPES = ["profile:read", "history:read", "history:write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];
export const DEFAULT_SCOPE: OAuthScope = "profile:read";

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface OAuthClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

export interface OAuthCodeRow {
  code_hash: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  expires_at: string;
}

export interface OAuthTokenRow {
  token_hash: string;
  refresh_hash: string | null;
  client_id: string;
  user_id: string;
  scope: string;
  access_expires_at: string;
  refresh_expires_at: string;
  revoked: boolean;
}

export interface OAuthDb {
  insertClient(row: Omit<OAuthClientRow, "client_id">): Promise<OAuthClientRow>;
  getClient(clientId: string): Promise<OAuthClientRow | null>;
  insertCode(row: OAuthCodeRow): Promise<void>;
  /** Fetch AND delete — auth codes are strictly single-use. */
  consumeCode(codeHash: string): Promise<OAuthCodeRow | null>;
  insertToken(row: OAuthTokenRow): Promise<void>;
  getTokenByAccessHash(hash: string): Promise<OAuthTokenRow | null>;
  getTokenByRefreshHash(hash: string): Promise<OAuthTokenRow | null>;
  revokeToken(tokenHash: string): Promise<void>;
  touchToken(tokenHash: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Crypto helpers

const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

/** RFC 7636 S256: base64url(sha256(verifier)). */
export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

const newSecret = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;

// ---------------------------------------------------------------------------
// Validation

/** https only, except localhost for local MCP clients; exact-match at authorize time. */
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

export function parseScope(scope: string | undefined | null): OAuthScope[] | null {
  if (!scope || !scope.trim()) return [DEFAULT_SCOPE];
  const parts = [...new Set(scope.trim().split(/\s+/))];
  if (parts.length > OAUTH_SCOPES.length) return null;
  const valid = parts.every((p) => (OAUTH_SCOPES as readonly string[]).includes(p));
  return valid ? (parts as OAuthScope[]) : null;
}

// ---------------------------------------------------------------------------
// Flows

export class OAuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function registerClient(
  db: OAuthDb,
  input: { client_name?: unknown; redirect_uris?: unknown },
): Promise<OAuthClientRow & { token_endpoint_auth_method: string; grant_types: string[]; response_types: string[] }> {
  const name = typeof input.client_name === "string" ? input.client_name.trim().slice(0, 120) : "";
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris : [];
  if (!name) throw new OAuthError("invalid_client_metadata", "client_name is required");
  if (uris.length < 1 || uris.length > 5 || !uris.every((u) => typeof u === "string" && u.length <= 500 && isAllowedRedirectUri(u))) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris must be 1-5 https URLs (http allowed for localhost only)");
  }
  const row = await db.insertClient({ client_name: name, redirect_uris: uris as string[] });
  return {
    ...row,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

export interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

/** Validates an authorize request; throws OAuthError on anything off-spec. */
export async function validateAuthorizeRequest(db: OAuthDb, p: AuthorizeParams): Promise<{ client: OAuthClientRow; scopes: OAuthScope[] }> {
  const client = await db.getClient(p.client_id);
  if (!client) throw new OAuthError("invalid_client", "unknown client_id");
  if (!client.redirect_uris.includes(p.redirect_uri)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uri is not registered for this client");
  }
  if (p.response_type !== "code") throw new OAuthError("unsupported_response_type", "only response_type=code is supported");
  if (!p.code_challenge || (p.code_challenge_method ?? "S256") !== "S256") {
    throw new OAuthError("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  const scopes = parseScope(p.scope);
  if (!scopes) throw new OAuthError("invalid_scope", `supported scopes: ${OAUTH_SCOPES.join(" ")}`);
  return { client, scopes };
}

export async function createAuthCode(
  db: OAuthDb,
  input: { clientId: string; userId: string; redirectUri: string; scopes: OAuthScope[]; codeChallenge: string },
): Promise<string> {
  const code = newSecret("vd_ac_");
  await db.insertCode({
    code_hash: sha256hex(code),
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    scope: input.scopes.join(" "),
    code_challenge: input.codeChallenge,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  return code;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

async function issueTokens(db: OAuthDb, clientId: string, userId: string, scope: string): Promise<TokenResponse> {
  const access = newSecret("vd_at_");
  const refresh = newSecret("vd_rt_");
  await db.insertToken({
    token_hash: sha256hex(access),
    refresh_hash: sha256hex(refresh),
    client_id: clientId,
    user_id: userId,
    scope,
    access_expires_at: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
    revoked: false,
  });
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    scope,
  };
}

export async function exchangeAuthCode(
  db: OAuthDb,
  input: { code: string; codeVerifier: string; clientId: string; redirectUri: string },
): Promise<TokenResponse> {
  const row = await db.consumeCode(sha256hex(input.code));
  if (!row) throw new OAuthError("invalid_grant", "unknown or already-used code");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new OAuthError("invalid_grant", "code expired");
  if (row.client_id !== input.clientId) throw new OAuthError("invalid_grant", "code was issued to a different client");
  if (row.redirect_uri !== input.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri mismatch");
  if (pkceChallengeFromVerifier(input.codeVerifier) !== row.code_challenge) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }
  return issueTokens(db, row.client_id, row.user_id, row.scope);
}

export async function refreshTokens(
  db: OAuthDb,
  input: { refreshToken: string; clientId: string },
): Promise<TokenResponse> {
  const row = await db.getTokenByRefreshHash(sha256hex(input.refreshToken));
  if (!row || row.revoked) throw new OAuthError("invalid_grant", "unknown or revoked refresh token");
  if (row.client_id !== input.clientId) throw new OAuthError("invalid_grant", "token was issued to a different client");
  if (new Date(row.refresh_expires_at).getTime() < Date.now()) throw new OAuthError("invalid_grant", "refresh token expired");
  // Rotation: the old pair dies with every refresh.
  await db.revokeToken(row.token_hash);
  return issueTokens(db, row.client_id, row.user_id, row.scope);
}

export interface VerifiedToken {
  userId: string;
  clientId: string;
  scopes: OAuthScope[];
  expiresAt: number;
}

export async function verifyAccessToken(db: OAuthDb, token: string): Promise<VerifiedToken | null> {
  if (!token.startsWith("vd_at_")) return null;
  const row = await db.getTokenByAccessHash(sha256hex(token));
  if (!row || row.revoked) return null;
  const expiresAt = new Date(row.access_expires_at).getTime();
  if (expiresAt < Date.now()) return null;
  void db.touchToken(row.token_hash);
  return { userId: row.user_id, clientId: row.client_id, scopes: row.scope.split(" ") as OAuthScope[], expiresAt };
}

// ---------------------------------------------------------------------------
// Supabase-backed store (production)

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

class SupabaseOAuthDb implements OAuthDb {
  constructor(private sb: SupabaseClient) {}

  async insertClient(row: Omit<OAuthClientRow, "client_id">): Promise<OAuthClientRow> {
    const { data, error } = await this.sb.from("oauth_clients").insert(row).select().single();
    if (error) throw new Error(`oauth_clients insert failed: ${error.message}`);
    return data as OAuthClientRow;
  }

  async getClient(clientId: string): Promise<OAuthClientRow | null> {
    const { data, error } = await this.sb.from("oauth_clients").select("*").eq("client_id", clientId).maybeSingle();
    if (error) throw new Error(`oauth_clients read failed: ${error.message}`);
    return (data as OAuthClientRow) ?? null;
  }

  async insertCode(row: OAuthCodeRow): Promise<void> {
    const { error } = await this.sb.from("oauth_codes").insert(row);
    if (error) throw new Error(`oauth_codes insert failed: ${error.message}`);
  }

  async consumeCode(codeHash: string): Promise<OAuthCodeRow | null> {
    // delete().select() is atomic per row: two racing exchanges can't both win.
    const { data, error } = await this.sb.from("oauth_codes").delete().eq("code_hash", codeHash).select();
    if (error) throw new Error(`oauth_codes consume failed: ${error.message}`);
    return (data?.[0] as OAuthCodeRow) ?? null;
  }

  async insertToken(row: OAuthTokenRow): Promise<void> {
    const { error } = await this.sb.from("oauth_tokens").insert(row);
    if (error) throw new Error(`oauth_tokens insert failed: ${error.message}`);
  }

  async getTokenByAccessHash(hash: string): Promise<OAuthTokenRow | null> {
    const { data, error } = await this.sb.from("oauth_tokens").select("*").eq("token_hash", hash).maybeSingle();
    if (error) throw new Error(`oauth_tokens read failed: ${error.message}`);
    return (data as OAuthTokenRow) ?? null;
  }

  async getTokenByRefreshHash(hash: string): Promise<OAuthTokenRow | null> {
    const { data, error } = await this.sb.from("oauth_tokens").select("*").eq("refresh_hash", hash).maybeSingle();
    if (error) throw new Error(`oauth_tokens read failed: ${error.message}`);
    return (data as OAuthTokenRow) ?? null;
  }

  async revokeToken(tokenHash: string): Promise<void> {
    const { error } = await this.sb.from("oauth_tokens").update({ revoked: true }).eq("token_hash", tokenHash);
    if (error) throw new Error(`oauth_tokens revoke failed: ${error.message}`);
  }

  async touchToken(tokenHash: string): Promise<void> {
    await this.sb.from("oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", tokenHash);
  }
}

/** Production DB, or null when the Supabase env vars are absent (local dev). */
export function getOAuthDb(): OAuthDb | null {
  const sb = getServiceClient();
  return sb ? new SupabaseOAuthDb(sb) : null;
}

/** Resolves a Supabase Auth JWT (from the consent page) to a user id. */
export async function userIdFromSupabaseJwt(jwt: string): Promise<string | null> {
  const sb = getServiceClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}
