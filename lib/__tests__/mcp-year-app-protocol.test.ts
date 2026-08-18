// @vitest-environment node
//
// Node, not the project's default jsdom: mcp-handler streams the JSON-RPC
// response through Node's stream primitives, and under jsdom's globals it dies
// with "Unexpected chunk type: object" before any assertion runs.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMcpHandler } from "mcp-handler";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import {
  initMcpServer, SERVER_INFO,
  YEAR_STRIP_RESOURCE_URI, DAY_CURVE_RESOURCE_URI, PROFILE_RESOURCE_URI, HISTORY_RESOURCE_URI,
  FORECAST_RESOURCE_URI,
  TOOL_COUNT,
} from "../mcp-server";
import { YEAR_STRIP_META_KEY } from "@/widgets/year-strip/data";
import { DAY_CURVE_META_KEY } from "@/widgets/day-curve/data";
import { HISTORY_META_KEY } from "@/widgets/history/data";
import { PROFILE_META_KEY } from "@/widgets/profile/data";

/**
 * The companion to mcp-year-app.test.ts, which asserts registration against a
 * mocked server object. A mock proves we called the right functions; it cannot
 * prove the SDK and mcp-handler then put the metadata on the wire. This drives
 * the real handler with real JSON-RPC requests instead.
 *
 * mcp-handler returns a web-standard `fetch(Request) => Response`, so no Next
 * server is needed. Responses may come back as SSE, hence the `data:` unwrapping.
 */
const handler = createMcpHandler(
  initMcpServer,
  { serverInfo: SERVER_INFO },
  { basePath: "/api/mcp", verboseLogs: false, maxDuration: 30 },
);

let sessionId: string | undefined;

async function rpc(method: string, params: unknown, id = 1) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await handler(new Request("http://localhost/api/mcp/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }));
  const received = response.headers.get("mcp-session-id");
  if (received) sessionId = received;
  const body = await response.text();
  const line = body.split("\n").find((l) => l.startsWith("data:"));
  return JSON.parse(line ? line.slice(5).trim() : body);
}

async function connect() {
  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "vitest", version: "0.0.0" },
  });
}

/**
 * `get_current_status` reaches for live Open-Meteo UV and falls back to the
 * clear-sky model when it cannot. Left unstubbed, that is a real network call
 * inside a unit test: it resolved in ~90ms locally and hung past the 5s timeout
 * on CI, failing twice in a row on a commit that touches none of this code.
 *
 * Stubbed to reject, so the tool takes its documented offline path and the test
 * is deterministic. Nothing is lost: this file asserts that the SDK and
 * mcp-handler put the right metadata on the wire, for which the provenance of
 * the UV number is irrelevant, and the live path is covered by
 * app/api/__tests__/weather-route.test.ts, which mocks fetch too.
 */
const realFetch = globalThis.fetch;
beforeAll(() => {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("open-meteo.com")) return Promise.reject(new Error("offline in tests"));
    return realFetch(input, init);
  });
});
afterAll(() => vi.unstubAllGlobals());

describe("MCP App metadata on the wire", () => {
  it("marks exactly the widget-bearing tools and leaves the rest alone", async () => {
    await connect();
    const { result } = await rpc("tools/list", {}, 2);

    const withUi: Array<{ name: string; _meta: { ui: { resourceUri: string } } }> = result.tools.filter(
      (tool: { _meta?: Record<string, unknown> }) => tool._meta?.ui ?? tool._meta?.["ui/resourceUri"],
    );

    // Only the tools whose answer is genuinely worse as prose carry a widget;
    // the rest must stay clean. `set_history_location` is the newest and has
    // none: it takes a range and a city and answers in a sentence.
    // Pinned to the constant the stale-list hint quotes: adding a tool without
    // updating TOOL_COUNT would have the server tell clients a wrong number.
    expect(result.tools).toHaveLength(TOOL_COUNT);
    expect(withUi.map((t) => t.name).sort()).toEqual([
      "compare_vitamin_d_year", "configure_sun_profile",
      "get_current_status", "get_my_history", "get_sun_forecast", "get_vitamin_d_year",
    ]);
    // The comparison reuses the year strip's resource: same picture, one or many.
    expect(Object.fromEntries(withUi.map((t) => [t.name, t._meta.ui.resourceUri]))).toEqual({
      get_vitamin_d_year: YEAR_STRIP_RESOURCE_URI,
      compare_vitamin_d_year: YEAR_STRIP_RESOURCE_URI,
      get_current_status: DAY_CURVE_RESOURCE_URI,
      configure_sun_profile: PROFILE_RESOURCE_URI,
      get_my_history: HISTORY_RESOURCE_URI,
      get_sun_forecast: FORECAST_RESOURCE_URI,
    });
  });

  it.each([
    ["year strip", YEAR_STRIP_RESOURCE_URI],
    ["day curve", DAY_CURVE_RESOURCE_URI],
    ["profile picker", PROFILE_RESOURCE_URI],
    ["history calendar", HISTORY_RESOURCE_URI],
    ["forecast", FORECAST_RESOURCE_URI],
  ])("serves the %s as one self-contained document", async (_label, uri) => {
    await connect();
    const { result } = await rpc("resources/read", { uri }, 3);

    expect(result.contents[0].mimeType).toBe(RESOURCE_MIME_TYPE);
    expect(result.contents[0].text).toMatch(/^<!doctype html>/i);
    // Self-contained is the whole point: an iframe under a strict CSP cannot
    // fetch anything, so an external script or stylesheet is a broken widget.
    expect(result.contents[0].text).not.toMatch(/<script[^>]+src=/i);
    expect(result.contents[0].text).not.toMatch(/<link[^>]+href=/i);
  });

  it("answers a call with the model's text and the widget's private data", async () => {
    await connect();
    const { result } = await rpc(
      "tools/call",
      { name: "get_vitamin_d_year", arguments: { lat: 51.51, lon: -0.13, timezone: "Europe/London" } },
      4,
    );

    const text = result.content[0].text;
    expect(text).toContain("monthsWithSun");
    expect(text).not.toContain("hoursByDay");
    expect(result._meta[YEAR_STRIP_META_KEY].hoursByDay).toHaveLength(365);
    // structuredContent is surfaced to the model by clients that support it, so
    // the chart data must not be there — that is why _meta carries it.
    expect(result.structuredContent).toBeUndefined();
  });

  it("compares several places in one call, on one shared payload", async () => {
    await connect();
    const { result } = await rpc(
      "tools/call",
      {
        name: "compare_vitamin_d_year",
        arguments: {
          places: [
            { name: "Reykjavik", lat: 64.15, lon: -21.94, timezone: "Atlantic/Reykjavik" },
            { name: "Singapore", lat: 1.35, lon: 103.82, timezone: "Asia/Singapore" },
          ],
        },
      },
      6,
    );

    const text = JSON.parse(result.content[0].text);
    expect(text.places.map((p: { name: string }) => p.name)).toEqual(["Reykjavik", "Singapore"]);
    // The ranking is spelled out so the model does not re-derive it and slip.
    expect(text.rankedByViableDays).toEqual(["Singapore", "Reykjavik"]);
    expect(result.content[0].text).not.toContain("hoursByDay");

    const chart = result._meta[YEAR_STRIP_META_KEY];
    expect(chart.places).toHaveLength(2);
    expect(chart.places[0].hoursByDay).toHaveLength(365);
    expect(chart.places[0].name).toBe("Reykjavik");
  });

  it("tells the history widget it is unauthenticated instead of leaving it blank", async () => {
    // The public endpoint carries no token, so this is the state a user hits
    // when they connect the wrong connector — the widget must be able to say so.
    await connect();
    const { result } = await rpc("tools/call", { name: "get_my_history", arguments: {} }, 7);

    expect(result.content[0].text).toContain("authentication_required");
    const chart = result._meta[HISTORY_META_KEY];
    expect(chart.authenticated).toBe(false);
    expect(chart.days).toEqual([]);
  });

  it("tells the profile widget it cannot save on the public connector", async () => {
    await connect();
    const { result } = await rpc(
      "tools/call",
      { name: "configure_sun_profile", arguments: { lat: 41.39, lon: 2.17, placeName: "Barcelona" } },
      8,
    );

    // No token here, so no profile:write — the widget must show "for this
    // conversation only" rather than offering a save that would be refused.
    expect(result._meta[PROFILE_META_KEY].canSave).toBe(false);
    expect(result.content[0].text).toContain('"savesToAccount": false');
  });

  it("refuses to write the profile without the scope", async () => {
    await connect();
    const { result } = await rpc(
      "tools/call",
      { name: "update_my_profile", arguments: { skinType: 5 } },
      9,
    );

    expect(result.content[0].text).toContain("authentication_required");
  });

  it("answers get_current_status with the verdict data the hero needs", async () => {
    await connect();
    const { result } = await rpc(
      "tools/call",
      { name: "get_current_status", arguments: { lat: 40.42, lon: -3.7, timezone: "Europe/Madrid" } },
      5,
    );

    const text = result.content[0].text;
    expect(text).toContain("currentUVIndex");
    expect(text).not.toContain("elevations");

    const chart = result._meta[DAY_CURVE_META_KEY];
    // What the widget renders is the app's own hero: a verdict and a few
    // numbers. The elevation curve it used to carry was dropped in #29 — it
    // answered a question nobody asked, and it was most of the payload.
    expect(["good_now", "upcoming", "window_closed", "no_synthesis"]).toContain(chart.state);
    expect([null, "optimal", "moderate"]).toContain(chart.intensity);
    expect(typeof chart.uvIndex).toBe("number");
    expect(chart).not.toHaveProperty("elevations");
    expect(chart).not.toHaveProperty("thresholdElevation");
  });
});
