import { describe, expect, it } from "vitest";
import { parsePayload, MAX_BATCH, MAX_PROPS } from "../analytics-ingest";

const NOW = new Date("2026-08-30T22:00:00.000Z");
const V = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";

const payload = (over: Record<string, unknown> = {}) => ({
  visitorId: V,
  sessionId: S,
  events: [{ name: "visit", props: { kind: "first" }, ts: NOW.getTime() }],
  ...over,
});

describe("parsePayload", () => {
  it("accepts a well-formed batch and normalises it for storage", () => {
    const out = parsePayload(payload({ path: "/es/dashboard", locale: "es", authed: true }), NOW);
    expect(out).not.toBeNull();
    expect(out!.visitorId).toBe(V);
    expect(out!.events).toEqual([
      {
        name: "visit",
        props: { kind: "first" },
        path: "/es/dashboard",
        locale: "es",
        referrerHost: null,
        authed: true,
        occurredAt: NOW.toISOString(),
      },
    ]);
  });

  // The endpoint is public and unauthenticated — it has to be, the events come
  // from browsers. Everything below is a way a malformed or hostile body could
  // otherwise reach the database.
  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["missing visitorId", { sessionId: S, events: [] }],
    ["a visitorId that is not a UUID", payload({ visitorId: "'; drop table --" })],
    ["a sessionId that is not a UUID", payload({ sessionId: "42" })],
    ["events not an array", payload({ events: { name: "visit" } })],
  ])("rejects %s", (_label, body) => {
    expect(parsePayload(body, NOW)).toBeNull();
  });

  it("drops individual bad events instead of failing the whole batch", () => {
    const out = parsePayload(
      payload({
        events: [
          { name: "visit", ts: NOW.getTime() },
          { name: "", ts: NOW.getTime() },
          { name: 42, ts: NOW.getTime() },
          { name: "push_enabled", ts: NOW.getTime() },
        ],
      }),
      NOW,
    );
    expect(out!.events.map((e) => e.name)).toEqual(["visit", "push_enabled"]);
  });

  it("returns null when nothing in the batch survived, so the route can 400", () => {
    expect(parsePayload(payload({ events: [] }), NOW)).toBeNull();
    expect(parsePayload(payload({ events: [{ name: "" }] }), NOW)).toBeNull();
  });

  it("caps the batch so one request cannot dump unbounded rows", () => {
    const many = Array.from({ length: MAX_BATCH + 20 }, () => ({ name: "visit", ts: NOW.getTime() }));
    expect(parsePayload(payload({ events: many }), NOW)!.events).toHaveLength(MAX_BATCH);
  });

  it("truncates an over-long event name rather than storing it whole", () => {
    const out = parsePayload(payload({ events: [{ name: "x".repeat(500), ts: NOW.getTime() }] }), NOW);
    expect(out!.events[0].name.length).toBeLessThanOrEqual(64);
  });

  describe("props", () => {
    it("keeps only scalar values and drops nested structures", () => {
      const out = parsePayload(
        payload({
          events: [{
            name: "visit",
            ts: NOW.getTime(),
            props: { a: "x", b: 2, c: true, d: null, e: { nested: 1 }, f: [1, 2] },
          }],
        }),
        NOW,
      );
      expect(out!.events[0].props).toEqual({ a: "x", b: 2, c: true, d: null });
    });

    it("caps how many properties one event can carry", () => {
      const props = Object.fromEntries(
        Array.from({ length: MAX_PROPS + 10 }, (_, i) => [`k${i}`, i]),
      );
      const out = parsePayload(payload({ events: [{ name: "visit", ts: NOW.getTime(), props }] }), NOW);
      expect(Object.keys(out!.events[0].props)).toHaveLength(MAX_PROPS);
    });

    it("truncates long string values", () => {
      const out = parsePayload(
        payload({ events: [{ name: "visit", ts: NOW.getTime(), props: { a: "y".repeat(1000) } }] }),
        NOW,
      );
      expect((out!.events[0].props.a as string).length).toBeLessThanOrEqual(128);
    });

    it("drops non-finite numbers, which are not valid JSON and break the insert", () => {
      const out = parsePayload(
        payload({ events: [{ name: "visit", ts: NOW.getTime(), props: { a: Infinity, b: NaN, c: 1 } }] }),
        NOW,
      );
      expect(out!.events[0].props).toEqual({ c: 1 });
    });
  });

  describe("timestamps", () => {
    // A browser clock is not trustworthy. An event stamped in 2087 would sit at
    // the top of every "recent activity" query forever.
    it("falls back to now for a clock in the future", () => {
      const out = parsePayload(
        payload({ events: [{ name: "visit", ts: NOW.getTime() + 86_400_000 }] }),
        NOW,
      );
      expect(out!.events[0].occurredAt).toBe(NOW.toISOString());
    });

    it("falls back to now for an implausibly old or missing timestamp", () => {
      const old = parsePayload(
        payload({ events: [{ name: "visit", ts: NOW.getTime() - 90 * 86_400_000 }] }),
        NOW,
      );
      expect(old!.events[0].occurredAt).toBe(NOW.toISOString());

      const none = parsePayload(payload({ events: [{ name: "visit" }] }), NOW);
      expect(none!.events[0].occurredAt).toBe(NOW.toISOString());
    });

    it("keeps a plausible recent timestamp, so batching does not flatten ordering", () => {
      const earlier = NOW.getTime() - 30_000;
      const out = parsePayload(payload({ events: [{ name: "visit", ts: earlier }] }), NOW);
      expect(out!.events[0].occurredAt).toBe(new Date(earlier).toISOString());
    });
  });

  describe("referrer", () => {
    it("stores only the host, never the query string", () => {
      const out = parsePayload(
        payload({ referrer: "https://news.ycombinator.com/item?id=123&utm_source=x" }),
        NOW,
      );
      expect(out!.events[0].referrerHost).toBe("news.ycombinator.com");
    });

    it("ignores an unparseable referrer instead of storing junk", () => {
      const out = parsePayload(payload({ referrer: "javascript:alert(1)" }), NOW);
      expect(out!.events[0].referrerHost).toBeNull();
    });
  });

  it("keeps the path but discards any query string on it", () => {
    const out = parsePayload(payload({ path: "/es/dashboard?token=secret" }), NOW);
    expect(out!.events[0].path).toBe("/es/dashboard");
  });
});

/**
 * Regression: the browser sends no referrer for internal navigations (the client
 * strips its own host), but the server must still behave if one arrives — from
 * an older client, or a hand-made request.
 */
describe("referrer host is stored verbatim when present", () => {
  it("keeps a third-party host", () => {
    const out = parsePayload(payload({ referrer: "https://www.producthunt.com/posts/vitamind" }), NOW);
    expect(out!.events[0].referrerHost).toBe("www.producthunt.com");
  });
});

/**
 * The path used to live only on the envelope, so every event in a batch was
 * labelled with whatever page the user happened to be on when the queue
 * flushed. Observed in the dev deployment: a `visit` that happened on `/` was
 * stored as `/dashboard` because the batch left after a navigation. An event
 * carries its own page now; the envelope is only the fallback.
 */
describe("per-event path", () => {
  it("prefers the path the event itself carries", () => {
    const out = parsePayload(
      payload({
        path: "/dashboard",
        events: [
          { name: "visit", ts: NOW.getTime(), path: "/" },
          { name: "city_selected", ts: NOW.getTime() },
        ],
      }),
      NOW,
    );
    expect(out!.events.map((e) => e.path)).toEqual(["/", "/dashboard"]);
  });

  it("strips a query string from a per-event path too", () => {
    const out = parsePayload(
      payload({ events: [{ name: "visit", ts: NOW.getTime(), path: "/x?token=secret" }] }),
      NOW,
    );
    expect(out!.events[0].path).toBe("/x");
  });
});
