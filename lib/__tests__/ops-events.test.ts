import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateAlerts, ALERT_THRESHOLDS, opsEnv, upstreamFailure, type OpsCounts } from "@/lib/ops-events";

describe("evaluateAlerts", () => {
  const zero: OpsCounts = { upstream_error: 0, upstream_timeout: 0, fallback: 0 };

  it("is silent on a normal hour", () => {
    expect(evaluateAlerts(zero)).toEqual([]);
    expect(evaluateAlerts({ ...zero, upstream_error: ALERT_THRESHOLDS.failures - 1 })).toEqual([]);
  });

  it("alerts when readers are getting errors, counting timeouts with errors", () => {
    const a = evaluateAlerts({ ...zero, upstream_error: 1, upstream_timeout: ALERT_THRESHOLDS.failures - 1 });
    expect(a).toHaveLength(1);
    expect(a[0].severity).toBe("critical");
    expect(a[0].count).toBe(ALERT_THRESHOLDS.failures);
  });

  it("alerts separately, and less loudly, when the degraded path is carrying the load", () => {
    const a = evaluateAlerts({ ...zero, fallback: ALERT_THRESHOLDS.fallbacks });
    expect(a).toHaveLength(1);
    expect(a[0].severity).toBe("warning");
  });

  it("reports both when both happen", () => {
    expect(evaluateAlerts({ upstream_error: 50, upstream_timeout: 0, fallback: 50 })).toHaveLength(2);
  });
});

describe("opsEnv", () => {
  const saved = process.env.VERCEL_ENV;
  afterEach(() => { process.env.VERCEL_ENV = saved; });

  it("is Vercel's own environment name, and 'development' anywhere else", () => {
    process.env.VERCEL_ENV = "production";
    expect(opsEnv()).toBe("production");
    process.env.VERCEL_ENV = "preview";
    expect(opsEnv()).toBe("preview");
    delete process.env.VERCEL_ENV;
    expect(opsEnv()).toBe("development");
  });
});

describe("upstreamFailure", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("keeps the status and at most 200 characters of the upstream's own text", async () => {
    const res = new Response("x".repeat(500), { status: 429 });
    const f = await upstreamFailure("weather", "https://api.open-meteo.com/v1/forecast?latitude=1", res);
    expect(f).toMatchObject({ source: "weather", kind: "upstream_error", upstream: "api.open-meteo.com", status: 429 });
    expect(f.detail!.length).toBe(200);
  });

  it("calls an abort a timeout and anything else an error, by exception name only", async () => {
    const timeout = await upstreamFailure("weather", "https://api.open-meteo.com/", new DOMException("t", "TimeoutError"));
    expect(timeout).toMatchObject({ kind: "upstream_timeout", status: null, detail: "TimeoutError" });
    const other = await upstreamFailure("weather", "https://api.open-meteo.com/", new TypeError("fetch failed"));
    expect(other).toMatchObject({ kind: "upstream_error", status: null, detail: "TypeError: fetch failed" });
  });

  it("never records the request's query string, which carries the reader's coordinates", async () => {
    const f = await upstreamFailure("weather", "https://api.open-meteo.com/v1/forecast?latitude=51.51&longitude=-0.13", new Response("", { status: 500 }));
    expect(JSON.stringify(f)).not.toContain("51.51");
  });
});

describe("upstreamFailure — coordinates inside an upstream's error text", () => {
  it("are scrubbed too", async () => {
    const f = await upstreamFailure("weather", "https://api.open-meteo.com/", new Response('{"reason":"No data for latitude 51.51, longitude -0.13"}', { status: 400 }));
    expect(f.detail).not.toContain("51.51");
    expect(f.detail).not.toContain("-0.13");
  });
});
