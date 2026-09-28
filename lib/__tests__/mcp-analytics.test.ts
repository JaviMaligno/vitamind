// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureMcpCall, recordMcpCall } from "../mcp-analytics";
import { initMcpServer, TOOL_COUNT } from "../mcp-server";
import * as personal from "../mcp-personal";

const mocks = vi.hoisted(() => ({
  after: vi.fn(), insert: vi.fn(), abortSignal: vi.fn(), from: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: mocks.from }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ abortSignal: mocks.abortSignal });
  mocks.abortSignal.mockResolvedValue({ error: null });
  mocks.after.mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const json = (payload: unknown) => ({ content: [{ type: "text", text: JSON.stringify(payload) }] });
async function flush() {
  for (const [run] of mocks.after.mock.calls) await run();
}

describe("MCP usage analytics", () => {
  it("preserves the response and defers one allowlisted row without logging", async () => {
    const log = vi.spyOn(console, "log");
    const reply = json({ lat: 28.12, userId: "private", token: "secret", synthesisPossible: false });
    expect(await measureMcpCall("get_current_status", () => reply)).toBe(reply);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await flush();
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith({
      tool: "get_current_status", env: "production", outcome: "success",
      occurred_at: expect.any(String), duration_ms: expect.any(Number),
    });
    expect(mocks.from).toHaveBeenCalledWith("mcp_call_events");
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.insert.mock.calls[0][0].duration_ms).toBeGreaterThanOrEqual(0);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    [json({ error: "authentication_required" }), "authentication_required"],
    [json({ error: "insufficient_scope" }), "insufficient_scope"],
    [json({ error: "bad_range", hint: "private" }), "tool_error"],
    [{ isError: true, content: [{ type: "text", text: "private error" }] }, "tool_error"],
  ])("classifies returned errors without persisting their contents", async (reply, outcome) => {
    expect(await measureMcpCall("get_my_history", async () => reply)).toBe(reply);
    await flush();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0].outcome).toBe(outcome);
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain("private");
  });

  it("preserves a thrown error and still records one exception", async () => {
    const error = new Error("private upstream payload");
    await expect(measureMcpCall("search_city", () => { throw error; })).rejects.toBe(error);
    await flush();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0].outcome).toBe("exception");
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain(error.message);
  });

  it.each(["preview", "development"])("separates %s from production", async (env) => {
    vi.stubEnv("VERCEL_ENV", env === "development" ? "" : env);
    await measureMcpCall("get_sun_times", () => json({}));
    await flush();
    expect(mocks.insert.mock.calls[0][0].env).toBe(env);
  });

  it("isolates storage rejection and logs only a generic failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.abortSignal.mockRejectedValue(new Error("secret credentials"));
    await expect(recordMcpCall({tool: "search_city", duration_ms: 4, outcome: "success", occurred_at: new Date().toISOString()})).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[mcp-analytics] insert failed");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
  });

  it("detects PostgREST errors as well as thrown failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.abortSignal.mockResolvedValue({ error: { message: "missing table" } });
    await measureMcpCall("search_city", () => json({}));
    await flush();
    expect(log).toHaveBeenCalledWith("[mcp-analytics] insert failed");
  });

  it("awaits the write outside a Next request without changing the result", async () => {
    mocks.after.mockImplementation(() => { throw new Error("no request context"); });
    const reply = json({});
    expect(await measureMcpCall("search_city", () => reply)).toBe(reply);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});


describe("MCP registration analytics integration", () => {
  function registered() {
    type Callback = (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;
    const callbacks = new Map<string, Callback>();
    initMcpServer({
      tool: (name: string, _description: unknown, _schema: unknown, callback: Callback) => callbacks.set(name, callback),
      registerTool: (name: string, _config: unknown, callback: Callback) => callbacks.set(name, callback),
      registerResource: vi.fn(),
    } as never);
    expect(callbacks.size).toBe(TOOL_COUNT);
    return callbacks;
  }

  it("records a real public calculation without changing its result", async () => {
    const result = await registered().get("get_sun_times")!({lat: 28, lon: -16, date: "2026-09-28"}, {});
    expect(JSON.parse(result.content[0].text)).toHaveProperty("sunrise");
    await flush();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({tool: "get_sun_times", outcome: "success"});
  });

  it.each(["get_my_profile", "get_my_cities", "update_my_profile", "get_my_history", "log_sun_session", "set_history_location"])("records %s auth refusals exactly once", async (tool) => {
    const result = await registered().get(tool)!({}, {});
    expect(JSON.parse(result.content[0].text).error).toBe("authentication_required");
    await flush();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({tool, outcome: "authentication_required"});
  });

  it.each([true, false])("records authenticated personal calls once (profile exists: %s)", async (exists) => {
    const profile = { skin_type: 3, area_fraction: 0.25, age: null, target_iu: 1000,
      favorites: [], custom_locations: [], last_city_id: null, history: [] };
    const getProfile = vi.fn().mockResolvedValue(exists ? profile : null);
    vi.spyOn(personal, "getProfileStore").mockReturnValue({getProfile, updateHistory: vi.fn(), updateProfile: vi.fn()});
    const result = await registered().get("get_my_profile")!({}, {authInfo: {scopes: ["profile:read"], extra: {userId: "private-user"}}});
    expect(getProfile).toHaveBeenCalledExactlyOnceWith("private-user");
    expect(JSON.parse(result.content[0].text)).toMatchObject(exists ? {skinType: 3} : {error: "no_profile"});
    await flush();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({tool: "get_my_profile", outcome: exists ? "success" : "tool_error"});
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain("private-user");
  });

  it("records insufficient OAuth scope without touching the profile store", async () => {
    const result = await registered().get("get_my_profile")!({}, {authInfo: {scopes: [], extra: {userId: "private-user"}}});
    expect(JSON.parse(result.content[0].text).error).toBe("insufficient_scope");
    await flush();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({tool: "get_my_profile", outcome: "insufficient_scope"});
    expect(JSON.stringify(mocks.insert.mock.calls)).not.toContain("private-user");
  });
});
