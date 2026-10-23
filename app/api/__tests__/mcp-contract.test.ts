// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyToken: vi.fn(), getProfile: vi.fn() }));
vi.mock("@/lib/mcp-analytics", () => ({
  measureMcpCall: async (_tool: string, run: () => unknown) => run(),
}));
vi.mock("@/lib/mcp-server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mcp-server")>(),
  verifyToken: mocks.verifyToken,
}));
vi.mock("@/lib/mcp-personal", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mcp-personal")>(),
  getProfileStore: () => ({ getProfile: mocks.getProfile }),
}));

import { POST as publicPost } from "../mcp/[transport]/route";
import { POST as accountPost } from "../mcp-auth/[transport]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyToken.mockResolvedValue(undefined);
  mocks.getProfile.mockResolvedValue({
    skin_type: 2, area_fraction: 0.18, age: 38, target_iu: 1000,
    favorites: [], custom_locations: [], last_city_id: null, history: [],
  });
  vi.stubGlobal("fetch", () => Promise.reject(new Error("network forbidden in MCP contract tests")));
});
afterEach(() => vi.unstubAllGlobals());

async function call(handler: typeof publicPost, endpoint: string, name: string, token?: string, args?: Record<string, unknown>) {
  const response = await handler(new Request(`https://fixture.invalid${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name, arguments: args ?? (name === "search_city" ? { query: "Madrid" } : {}),
    } }),
  }));
  const body = await response.text();
  const data = body.split("\n").find((line) => line.startsWith("data:"));
  return { response, message: response.status === 200 ? JSON.parse(data ? data.slice(5) : body) : undefined };
}

describe("MCP public and account HTTP contracts", () => {
  it("keeps public tools available without an account", async () => {
    const { response, message } = await call(publicPost, "/api/mcp/mcp", "search_city");
    expect(response.status).toBe(200);
    expect(message.result.content[0].text).toContain("Madrid");
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("challenges unauthenticated account requests with resource metadata", async () => {
    const { response } = await call(accountPost, "/api/mcp-auth/mcp", "get_my_profile");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("does not read personal data when the verified token lacks scope", async () => {
    mocks.verifyToken.mockResolvedValue({ token: "synthetic", clientId: "fixture", scopes: [], extra: { userId: "user-own" } });
    const { message } = await call(accountPost, "/api/mcp-auth/mcp", "get_my_profile", "synthetic");
    expect(message.result.content[0].text).toContain("insufficient_scope");
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("preserves the verified user's identity at the personal store boundary", async () => {
    mocks.verifyToken.mockResolvedValue({ token: "synthetic", clientId: "fixture", scopes: ["profile:read"], extra: { userId: "user-own" } });
    const { message } = await call(accountPost, "/api/mcp-auth/mcp", "get_my_profile", "synthetic");
    expect(message.result.content[0].text).toContain('"skinType": 2');
    expect(mocks.getProfile).toHaveBeenCalledExactlyOnceWith("user-own");
  });

  it("bounds tool input before schema validation", async () => {
    const { message } = await call(publicPost, "/api/mcp/mcp", "search_city", undefined, { query: "Madrid", extra: Array(10000).fill(0) });
    expect(JSON.stringify(message)).toContain("maximum of 10000");
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("does not serve new transport paths introduced by a handler upgrade", async () => {
    const { response } = await call(publicPost, "/api/mcp/unrecognized", "search_city");
    expect(response.status).toBe(404);
  });
});
