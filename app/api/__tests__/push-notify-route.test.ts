import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getAllSubscriptions = vi.fn();
const removeSubscription = vi.fn();
const claimNotification = vi.fn();

vi.mock("@/lib/push-store", () => ({
  getAllSubscriptions: (...args: unknown[]) => getAllSubscriptions(...args),
  removeSubscription: (...args: unknown[]) => removeSubscription(...args),
  claimNotification: (...args: unknown[]) => claimNotification(...args),
}));

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
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
  claimNotification.mockResolvedValue(true);
  sendNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

/**
 * The run used to iterate every subscription regardless of where the subscriber
 * was: one cron at 08:00 UTC meant 04:00 in New York and 01:00 in Los Angeles.
 * The endpoint is now invoked once an hour and picks only the subscriptions
 * whose own clock reads a morning hour — so these tests are about WHO a run
 * touches, not about what it says.
 */
function madridSub(over: Record<string, unknown> = {}) {
  return {
    subscription: {
      endpoint: "https://push.example/madrid",
      keys: { p256dh: "p", auth: "a" },
    },
    lat: 40.4168,
    lon: -3.7038,
    tz: 2,
    timezone: "Europe/Madrid",
    skinType: 3,
    areaFraction: 0.25,
    cityName: "Madrid",
    locale: "es",
    createdAt: 0,
    ...over,
  };
}

/** Open-Meteo stub: a clear high-UV summer day, so nothing is skipped for UV. */
function stubHighUV() {
  const hourly = {
    time: Array.from({ length: 24 }, (_, h) => `2026-06-21T${String(h).padStart(2, "0")}:00`),
    uv_index: Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 18 ? 8 : 0)),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly }) }),
  );
}

function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("/api/push/notify local-hour selection", () => {
  beforeEach(() => {
    stubHighUV();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    getAllSubscriptions.mockResolvedValue([madridSub()]);
  });

  it("sends to a subscriber whose local clock is inside the morning window", async () => {
    at("2026-06-21T08:00:00Z"); // 10:00 in Madrid
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(claimNotification).toHaveBeenCalledWith("https://push.example/madrid", "2026-06-21");
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ sent: 1, deferred: 0, total: 1 });
  });

  it("does not send in the middle of the subscriber's night", async () => {
    at("2026-06-21T02:00:00Z"); // 04:00 in Madrid
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).not.toHaveBeenCalled();
    expect(claimNotification).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ sent: 0, deferred: 1, total: 1 });
  });

  it("does not send after the subscriber's morning has passed", async () => {
    at("2026-06-21T16:00:00Z"); // 18:00 in Madrid
    await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).not.toHaveBeenCalled();
  });

  /**
   * The stored `tz` is captured once at subscribe time, so a Madrid row created
   * in winter says `1` forever. Reading the hour from it would move every
   * decision an hour for half the year.
   */
  it("uses the IANA zone, not the integer offset frozen at subscribe time", async () => {
    getAllSubscriptions.mockResolvedValue([madridSub({ tz: 1 })]);
    at("2026-06-21T11:30:00Z"); // 13:30 in Madrid — past the window
    await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("falls back to the stored offset when the row has no zone name", async () => {
    getAllSubscriptions.mockResolvedValue([madridSub({ timezone: undefined, tz: 2 })]);
    at("2026-06-21T08:00:00Z");
    await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});

/**
 * 24 invocations a day, a schedule Vercel may fire twice, and a DST fall-back
 * that repeats an hour — the run has to be safe to repeat. The guard is a claim
 * on the subscriber's local day, taken BEFORE the push, so a lost race or a
 * replayed invocation costs a missed notification rather than a second one.
 */
describe("/api/push/notify once-a-day guard", () => {
  beforeEach(() => {
    stubHighUV();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  });

  it("skips a subscriber already notified on that local day", async () => {
    getAllSubscriptions.mockResolvedValue([madridSub({ lastNotifiedOn: "2026-06-21" })]);
    at("2026-06-21T08:00:00Z");
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(claimNotification).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ sent: 0, deferred: 1 });
  });

  it("still notifies when the stamp is yesterday's local day", async () => {
    getAllSubscriptions.mockResolvedValue([madridSub({ lastNotifiedOn: "2026-06-20" })]);
    at("2026-06-21T08:00:00Z");
    await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("does not push when another run has already claimed the day", async () => {
    getAllSubscriptions.mockResolvedValue([madridSub()]);
    claimNotification.mockResolvedValue(false);
    at("2026-06-21T08:00:00Z");
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ sent: 0, deferred: 1 });
  });

  /**
   * If the claim cannot be written the guard is not in force, and sending anyway
   * would mean up to three pushes a day to every subscriber. Fail the run
   * loudly instead — a 500 is what makes Vercel mark the cron invocation failed.
   */
  it("fails the run rather than pushing unguarded when the claim errors", async () => {
    getAllSubscriptions.mockResolvedValue([madridSub()]);
    claimNotification.mockRejectedValue(new Error('column "last_notified_on" does not exist'));
    at("2026-06-21T08:00:00Z");
    const res = await GET(request(URL_BASE, "Bearer test-secret"));
    expect(sendNotification).not.toHaveBeenCalled();
    expect(res.status).toBe(500);
  });

  it("force=true ignores both the window and the guard, so a manual test always fires", async () => {
    vi.stubEnv("PUSH_TEST_ALLOWED_ENDPOINT", "https://push.example/madrid");
    getAllSubscriptions.mockResolvedValue([madridSub({ lastNotifiedOn: "2026-06-21" })]);
    at("2026-06-21T02:00:00Z"); // 04:00 in Madrid, and already stamped for today
    const res = await GET(request(`${URL_BASE}?force=true`, "Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(claimNotification).not.toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
