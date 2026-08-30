import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const insertEvents = vi.fn();
vi.mock("@/lib/analytics-store", () => ({
  insertEvents: (...args: unknown[]) => insertEvents(...args),
}));

import { POST } from "@/app/api/events/route";

const V = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://getvitamind.app/api/events", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "https://getvitamind.app", ...headers },
  });
}

const body = (over: Record<string, unknown> = {}) => ({
  visitorId: V,
  sessionId: S,
  events: [{ name: "visit", ts: Date.now() }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  insertEvents.mockResolvedValue(1);
});

describe("POST /api/events", () => {
  it("stores a valid batch", async () => {
    const res = await POST(post(body()));
    expect(res.status).toBe(204);
    expect(insertEvents).toHaveBeenCalledOnce();
    expect(insertEvents.mock.calls[0][0]).toMatchObject({ visitorId: V, sessionId: S });
  });

  it("rejects a malformed body without touching the database", async () => {
    const res = await POST(post({ nonsense: true }));
    expect(res.status).toBe(400);
    expect(insertEvents).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON at all", async () => {
    const res = await POST(post("<html>not json</html>"));
    expect(res.status).toBe(400);
    expect(insertEvents).not.toHaveBeenCalled();
  });

  /**
   * The endpoint is public by necessity. A cross-origin caller is not a browser
   * of ours sending its own visit — it is someone else's page, or a script. The
   * Origin check is not a security boundary (it is trivially forged) but it does
   * keep casual noise out of a table whose whole value is that its numbers mean
   * something.
   */
  it("refuses a batch posted from another origin", async () => {
    const res = await POST(post(body(), { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(insertEvents).not.toHaveBeenCalled();
  });

  it("accepts a request with no Origin header, as beacons on some browsers send none", async () => {
    const req = new NextRequest("https://getvitamind.app/api/events", {
      method: "POST",
      body: JSON.stringify(body()),
      headers: { "content-type": "application/json" },
    });
    expect((await POST(req)).status).toBe(204);
  });

  it("rejects an oversized body before parsing it", async () => {
    const res = await POST(post(body(), { "content-length": String(200_000) }));
    expect(res.status).toBe(413);
    expect(insertEvents).not.toHaveBeenCalled();
  });

  /**
   * Analytics failing must never become the user's problem. The client fires
   * these from a beacon it cannot inspect, so the status is for our logs — but
   * a 500 here must not be a 500 the page ever sees, and must not throw.
   */
  it("answers 500 without throwing when the store fails", async () => {
    insertEvents.mockRejectedValue(new Error("supabase down"));
    const res = await POST(post(body()));
    expect(res.status).toBe(500);
  });
});
