// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
  // Next's app-route module proxies NextRequest and binds methods/getters to
  // the target. Native Request's constructor still cannot copy that Proxy's
  // private slots (Node 24: "Cannot read private member #state").
  function nextRouteRequest(endpoint: string, message: unknown, token?: string) {
    return new Proxy(new NextRequest(`https://fixture.invalid${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(message),
    }), {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  it.each([
    ["initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "health-check", version: "1" } }],
    ["tools/list", {}],
  ])("H1: accepts %s through Next's proxied request", async (method, params) => {
    const response = await publicPost(nextRouteRequest("/api/mcp/mcp", { jsonrpc: "2.0", id: 1, method, params }));
    expect(response.status).toBe(200);
    const body = await response.text();
    const data = body.split("\n").find((line) => line.startsWith("data:"));
    const message = JSON.parse(data ? data.slice(5) : body);
    expect(message.error).toBeUndefined();
    if (method === "tools/list") expect(message.result.tools).toHaveLength(15);
    else expect(message.result.serverInfo.name).toBe("vitamind-explorer");
  });

  it("H2: preserves OAuth identity through Next's proxied request", async () => {
    mocks.verifyToken.mockResolvedValue({ token: "synthetic", clientId: "fixture", scopes: ["profile:read"], extra: { userId: "user-own" } });
    const response = await accountPost(nextRouteRequest("/api/mcp-auth/mcp", {
      jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_my_profile", arguments: {} },
    }, "synthetic"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('\\"skinType\\": 2');
    expect(mocks.getProfile).toHaveBeenCalledExactlyOnceWith("user-own");
  });

  function streamingRequest(endpoint: string, declaredLength?: number, contentType = "application/json") {
    let pulls = 0;
    let cancelled = false;
    const chunk = new Uint8Array(64 * 1024).fill(32);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls <= 128) controller.enqueue(chunk);
        else {
          controller.enqueue(new TextEncoder().encode("{}"));
          controller.close();
        }
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const options: RequestInit & { duplex: "half" } = {
      method: "POST", body: stream, duplex: "half",
      headers: {
        "content-type": contentType,
        accept: "application/json, text/event-stream",
        ...(declaredLength === undefined ? {} : { "content-length": String(declaredLength) }),
      },
    };
    return {
      request: new Request(`https://fixture.invalid${endpoint}`, options),
      pulls: () => pulls, cancelled: () => cancelled,
    };
  }

  it("rejects an oversized declared JSON body before parsing it", async () => {
    const fixture = streamingRequest("/api/mcp/mcp", 8 * 1024 * 1024 + 2);
    const response = await publicPost(fixture.request);
    expect(response.status).toBe(413);
    expect(fixture.pulls()).toBe(0);
    expect(fixture.cancelled()).toBe(true);
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("bounds JSON streaming without a Content-Length header", async () => {
    const fixture = streamingRequest("/api/mcp/mcp");
    const response = await publicPost(fixture.request);
    expect(response.status).toBe(413);
    expect(fixture.pulls()).toBeLessThanOrEqual(65);
    expect(fixture.cancelled()).toBe(true);
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("challenges the account before reading even an oversized body", async () => {
    const fixture = streamingRequest("/api/mcp-auth/mcp", 8 * 1024 * 1024 + 2);
    const response = await accountPost(fixture.request);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    expect(fixture.pulls()).toBe(0);
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("also bounds malformed content types that the handler attempts to JSON-parse", async () => {
    const fixture = streamingRequest("/api/mcp/mcp", undefined, "application/json-malformed");
    const response = await publicPost(fixture.request);
    expect(response.status).toBe(413);
    expect(fixture.pulls()).toBeLessThanOrEqual(65);
    expect(fixture.cancelled()).toBe(true);
  });

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
