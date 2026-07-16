import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getAllSubscriptions = vi.fn();
const removeSubscription = vi.fn();

vi.mock("@/lib/push-store", () => ({
  getAllSubscriptions: (...args: unknown[]) => getAllSubscriptions(...args),
  removeSubscription: (...args: unknown[]) => removeSubscription(...args),
}));

import { GET } from "@/app/api/push/notify/route";

function request(url: string, auth?: string) {
  return new NextRequest(url, {
    headers: auth ? { authorization: auth } : undefined,
  });
}

const URL_BASE = "http://localhost/api/push/notify";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  getAllSubscriptions.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// The cron broadcaster is the highest-risk route in the app (it can push to
// every subscriber), so its gates must never regress.
describe("/api/push/notify auth gating", () => {
  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request(URL_BASE, "Bearer anything"));
    expect(res.status).toBe(500);
  });

  it("rejects a missing Authorization header", async () => {
    const res = await GET(request(URL_BASE));
    expect(res.status).toBe(401);
  });

  it("rejects a wrong bearer token", async () => {
    const res = await GET(request(URL_BASE, "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(getAllSubscriptions).not.toHaveBeenCalled();
  });

  it("accepts the correct bearer token", async () => {
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sent: 0, failed: 0, total: 0 });
  });
});

describe("/api/push/notify force-test gating", () => {
  it("rejects force=true when PUSH_TEST_ALLOWED_ENDPOINT is not set", async () => {
    const res = await GET(request(`${URL_BASE}?force=true`, "Bearer test-secret"));
    expect(res.status).toBe(400);
  });

  it("limits force=true to the allowed endpoint only", async () => {
    vi.stubEnv("PUSH_TEST_ALLOWED_ENDPOINT", "https://push.example/allowed");
    getAllSubscriptions.mockResolvedValue([
      { subscription: { endpoint: "https://push.example/other" } },
      { subscription: { endpoint: "https://push.example/another" } },
    ]);
    const res = await GET(request(`${URL_BASE}?force=true`, "Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Neither stored endpoint matches the allowlist → nothing is pushed.
    expect(body.total).toBe(0);
    expect(body.detail).toMatch(/No subscription matched/);
  });
});

describe("/api/push/notify error responses", () => {
  it("does not leak internal error detail when the store throws", async () => {
    getAllSubscriptions.mockRejectedValue(new Error("supabase: column secret_column does not exist"));
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret_column");
  });
});
