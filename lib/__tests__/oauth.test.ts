import { describe, it, expect } from "vitest";
import {
  registerClient, validateAuthorizeRequest, createAuthCode, exchangeAuthCode, refreshTokens,
  verifyAccessToken, pkceChallengeFromVerifier, isAllowedRedirectUri, parseScope,
  OAuthError, type OAuthDb, type OAuthClientRow, type OAuthCodeRow, type OAuthTokenRow,
} from "../oauth";

/** In-memory OAuthDb mirroring the Supabase-backed store's semantics. */
function memoryDb(): OAuthDb {
  const clients = new Map<string, OAuthClientRow>();
  const codes = new Map<string, OAuthCodeRow>();
  const tokens = new Map<string, OAuthTokenRow>();
  let seq = 0;
  return {
    async insertClient(row) {
      const client = { ...row, client_id: `client-${++seq}` };
      clients.set(client.client_id, client);
      return client;
    },
    async getClient(id) { return clients.get(id) ?? null; },
    async insertCode(row) { codes.set(row.code_hash, row); },
    async consumeCode(hash) {
      const row = codes.get(hash) ?? null;
      codes.delete(hash);
      return row;
    },
    async insertToken(row) { tokens.set(row.token_hash, row); },
    async getTokenByAccessHash(hash) { return tokens.get(hash) ?? null; },
    async getTokenByRefreshHash(hash) {
      return [...tokens.values()].find((t) => t.refresh_hash === hash) ?? null;
    },
    async revokeToken(hash) {
      const t = tokens.get(hash);
      if (t) t.revoked = true;
    },
    async touchToken() {},
  };
}

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "test-verifier-string-that-is-long-enough-for-pkce";

async function setupClientAndCode(db: OAuthDb) {
  const client = await registerClient(db, { client_name: "Claude", redirect_uris: [REDIRECT] });
  const code = await createAuthCode(db, {
    clientId: client.client_id,
    userId: "user-1",
    redirectUri: REDIRECT,
    scopes: ["profile:read", "history:write"],
    codeChallenge: pkceChallengeFromVerifier(VERIFIER),
  });
  return { client, code };
}

describe("redirect URI and scope validation", () => {
  it("accepts https and localhost http only", () => {
    expect(isAllowedRedirectUri("https://claude.ai/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:3334/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
  });

  it("parses scopes with a safe default and rejects unknown ones", () => {
    expect(parseScope(undefined)).toEqual(["profile:read"]);
    expect(parseScope("profile:read history:read")).toEqual(["profile:read", "history:read"]);
    expect(parseScope("admin:everything")).toBeNull();
  });
});

describe("authorize validation", () => {
  it("rejects unknown clients, foreign redirects and missing PKCE", async () => {
    const db = memoryDb();
    const { client } = await setupClientAndCode(db);
    const base = { client_id: client.client_id, redirect_uri: REDIRECT, response_type: "code", code_challenge: "x" };

    await expect(validateAuthorizeRequest(db, { ...base, client_id: "nope" })).rejects.toThrow(OAuthError);
    await expect(validateAuthorizeRequest(db, { ...base, redirect_uri: "https://evil.com" })).rejects.toThrow(/not registered/);
    await expect(validateAuthorizeRequest(db, { ...base, code_challenge: undefined })).rejects.toThrow(/PKCE/);
    await expect(validateAuthorizeRequest(db, { ...base, code_challenge_method: "plain" })).rejects.toThrow(/PKCE/);
    await expect(validateAuthorizeRequest(db, base)).resolves.toBeTruthy();
  });
});

describe("code exchange", () => {
  it("issues tokens for a valid code + verifier, and codes are single-use", async () => {
    const db = memoryDb();
    const { client, code } = await setupClientAndCode(db);

    const tokens = await exchangeAuthCode(db, {
      code, codeVerifier: VERIFIER, clientId: client.client_id, redirectUri: REDIRECT,
    });
    expect(tokens.access_token).toMatch(/^vd_at_/);
    expect(tokens.refresh_token).toMatch(/^vd_rt_/);
    expect(tokens.scope).toBe("profile:read history:write");

    await expect(exchangeAuthCode(db, {
      code, codeVerifier: VERIFIER, clientId: client.client_id, redirectUri: REDIRECT,
    })).rejects.toThrow(/already-used/);
  });

  it("rejects a wrong PKCE verifier and a wrong client", async () => {
    const db = memoryDb();
    const { client, code } = await setupClientAndCode(db);
    await expect(exchangeAuthCode(db, {
      code, codeVerifier: "wrong", clientId: client.client_id, redirectUri: REDIRECT,
    })).rejects.toThrow(/PKCE/);

    const { code: code2 } = await setupClientAndCode(db);
    await expect(exchangeAuthCode(db, {
      code: code2, codeVerifier: VERIFIER, clientId: "someone-else", redirectUri: REDIRECT,
    })).rejects.toThrow(/different client/);
  });
});

describe("access tokens", () => {
  it("verifies a live token and carries user, scopes and client", async () => {
    const db = memoryDb();
    const { client, code } = await setupClientAndCode(db);
    const tokens = await exchangeAuthCode(db, {
      code, codeVerifier: VERIFIER, clientId: client.client_id, redirectUri: REDIRECT,
    });

    const v = await verifyAccessToken(db, tokens.access_token);
    expect(v).not.toBeNull();
    expect(v!.userId).toBe("user-1");
    expect(v!.clientId).toBe(client.client_id);
    expect(v!.scopes).toContain("history:write");

    expect(await verifyAccessToken(db, "vd_at_forged")).toBeNull();
    expect(await verifyAccessToken(db, "some-supabase-jwt")).toBeNull();
  });

  it("refresh rotates the pair and kills the old access token", async () => {
    const db = memoryDb();
    const { client, code } = await setupClientAndCode(db);
    const first = await exchangeAuthCode(db, {
      code, codeVerifier: VERIFIER, clientId: client.client_id, redirectUri: REDIRECT,
    });

    const second = await refreshTokens(db, { refreshToken: first.refresh_token, clientId: client.client_id });
    expect(second.access_token).not.toBe(first.access_token);
    expect(await verifyAccessToken(db, first.access_token)).toBeNull();
    expect(await verifyAccessToken(db, second.access_token)).not.toBeNull();
  });
});
