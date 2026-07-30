// @vitest-environment node
//
// Node, not the project's default jsdom: mcp-handler streams the JSON-RPC
// response through Node's stream primitives, and under jsdom's globals it dies
// with "Unexpected chunk type: object" before any assertion runs.
import { describe, expect, it } from "vitest";
import { createMcpHandler } from "mcp-handler";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import { initMcpServer, SERVER_INFO, YEAR_STRIP_RESOURCE_URI, DAY_CURVE_RESOURCE_URI } from "../mcp-server";
import { YEAR_STRIP_META_KEY } from "@/widgets/year-strip/data";
import { DAY_CURVE_META_KEY } from "@/widgets/day-curve/data";

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

describe("MCP App metadata on the wire", () => {
  it("marks exactly the widget-bearing tools and leaves the rest alone", async () => {
    await connect();
    const { result } = await rpc("tools/list", {}, 2);

    const withUi: Array<{ name: string; _meta: { ui: { resourceUri: string } } }> = result.tools.filter(
      (tool: { _meta?: Record<string, unknown> }) => tool._meta?.ui ?? tool._meta?.["ui/resourceUri"],
    );

    // The tool set stays at ten for every client; only the tools whose answer is
    // genuinely worse as prose carry a widget, and the others must stay clean.
    expect(result.tools).toHaveLength(10);
    expect(withUi.map((t) => t.name).sort())
      .toEqual(["get_current_status", "get_vitamin_d_year"]);
    expect(Object.fromEntries(withUi.map((t) => [t.name, t._meta.ui.resourceUri]))).toEqual({
      get_vitamin_d_year: YEAR_STRIP_RESOURCE_URI,
      get_current_status: DAY_CURVE_RESOURCE_URI,
    });
  });

  it.each([
    ["year strip", YEAR_STRIP_RESOURCE_URI],
    ["day curve", DAY_CURVE_RESOURCE_URI],
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

  it("answers get_current_status with the day curve alongside the text", async () => {
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
    expect(chart.elevations).toHaveLength(97);
    expect(chart.stepMinutes).toBe(15);
    expect(typeof chart.thresholdElevation).toBe("number");
    expect(["good_now", "upcoming", "window_closed", "no_synthesis"]).toContain(chart.state);
  });
});
