import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const lastHourCounts = vi.fn();
vi.mock("@/lib/ops-events", async (orig) => ({
  ...(await orig<typeof import("@/lib/ops-events")>()),
  lastHourCounts: (...a: unknown[]) => lastHourCounts(...a),
}));
const { GET } = await import("@/app/api/ops/alerts/route");

const TOKEN = "t".repeat(40);
const req = (auth?: string) =>
  new NextRequest("http://localhost/api/ops/alerts", auth ? { headers: { authorization: auth } } : undefined);

const saved = process.env.OPS_ALERT_TOKEN;
beforeEach(() => { process.env.OPS_ALERT_TOKEN = TOKEN; lastHourCounts.mockReset(); });
afterEach(() => { process.env.OPS_ALERT_TOKEN = saved; });

describe("/api/ops/alerts", () => {
  it("is closed when no token is configured, rather than open", async () => {
    delete process.env.OPS_ALERT_TOKEN;
    expect((await GET(req(`Bearer ${TOKEN}`))).status).toBe(503);
    expect(lastHourCounts).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong token without touching the database", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(lastHourCounts).not.toHaveBeenCalled();
  });

  it("answers counts and the alerts they trigger", async () => {
    lastHourCounts.mockResolvedValue({ counts: { upstream_error: 4, upstream_timeout: 0, fallback: 0 }, recent: [] });
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body.counts.upstream_error).toBe(4);
    expect(body.alerts).toEqual([expect.objectContaining({ severity: "critical", count: 4 })]);
  });

  it("fails loudly when the monitoring itself cannot write or read", async () => {
    lastHourCounts.mockRejectedValue(new Error("heartbeat write failed: permission denied"));
    const res = await GET(req(`Bearer ${TOKEN}`));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("heartbeat");
  });
});
