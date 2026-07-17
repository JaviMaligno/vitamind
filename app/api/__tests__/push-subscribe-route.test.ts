import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const saveSubscription = vi.fn();
const removeSubscription = vi.fn();
const updateSubscriptionLocale = vi.fn();

vi.mock("@/lib/push-store", () => ({
  saveSubscription: (...args: unknown[]) => saveSubscription(...args),
  removeSubscription: (...args: unknown[]) => removeSubscription(...args),
  updateSubscriptionLocale: (...args: unknown[]) => updateSubscriptionLocale(...args),
}));

import { POST, PATCH, DELETE } from "@/app/api/push/subscribe/route";

function post(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "k", auth: "a" },
};

beforeEach(() => {
  vi.clearAllMocks();
  saveSubscription.mockResolvedValue(undefined);
  removeSubscription.mockResolvedValue(undefined);
  updateSubscriptionLocale.mockResolvedValue(undefined);
});

describe("POST /api/push/subscribe validation", () => {
  it("rejects a missing subscription", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect(saveSubscription).not.toHaveBeenCalled();
  });

  it("rejects a non-https endpoint", async () => {
    const res = await POST(post({ subscription: { endpoint: "http://insecure.example/x" } }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-URL endpoint", async () => {
    const res = await POST(post({ subscription: { endpoint: "not a url" } }));
    expect(res.status).toBe(400);
  });

  it("stores a valid subscription", async () => {
    const res = await POST(post({ subscription: VALID_SUB, lat: 40.4, lon: -3.7, skinType: 4 }));
    expect(res.status).toBe(200);
    expect(saveSubscription).toHaveBeenCalledOnce();
    expect(saveSubscription.mock.calls[0][0]).toMatchObject({ lat: 40.4, lon: -3.7, skinType: 4 });
  });

  it("clamps out-of-range numeric fields instead of storing garbage", async () => {
    await POST(post({ subscription: VALID_SUB, lat: 999, lon: -999, skinType: 42, areaFraction: 7 }));
    expect(saveSubscription.mock.calls[0][0]).toMatchObject({
      lat: 90,
      lon: -180,
      skinType: 6,
      areaFraction: 1,
    });
  });

  it("falls back to defaults for non-numeric fields", async () => {
    await POST(post({ subscription: VALID_SUB, lat: "evil", skinType: null }));
    expect(saveSubscription.mock.calls[0][0]).toMatchObject({ lat: 0, skinType: 3 });
  });

  it("whitelists the locale", async () => {
    await POST(post({ subscription: VALID_SUB, locale: "xx" }));
    expect(saveSubscription.mock.calls[0][0]).toMatchObject({ locale: "es" });
  });

  it("does not leak store error detail", async () => {
    saveSubscription.mockRejectedValue(new Error("relation push_subscriptions_secret does not exist"));
    const res = await POST(post({ subscription: VALID_SUB }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("push_subscriptions_secret");
  });
});

describe("PATCH /api/push/subscribe", () => {
  it("rejects an unsupported locale", async () => {
    const res = await PATCH(post({ endpoint: VALID_SUB.endpoint, locale: "xx" }, "PATCH"));
    expect(res.status).toBe(400);
  });

  it("updates the locale for a valid request", async () => {
    const res = await PATCH(post({ endpoint: VALID_SUB.endpoint, locale: "en" }, "PATCH"));
    expect(res.status).toBe(200);
    expect(updateSubscriptionLocale).toHaveBeenCalledWith(VALID_SUB.endpoint, "en");
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("rejects a missing endpoint", async () => {
    expect((await DELETE(post({}, "DELETE"))).status).toBe(400);
  });

  it("removes a valid endpoint", async () => {
    const res = await DELETE(post({ endpoint: VALID_SUB.endpoint }, "DELETE"));
    expect(res.status).toBe(200);
    expect(removeSubscription).toHaveBeenCalledWith(VALID_SUB.endpoint);
  });
});
