// @vitest-environment node
//
// Node, not the project's default jsdom: mcp-handler streams the JSON-RPC
// response through Node's stream primitives, and under jsdom's globals it dies
// with "Unexpected chunk type: object" before any assertion runs.
import { describe, expect, it } from "vitest";
import { createMcpHandler } from "mcp-handler";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import { initMcpServer, SERVER_INFO, YEAR_STRIP_RESOURCE_URI } from "../mcp-server";
import { YEAR_STRIP_META_KEY } from "@/widgets/year-strip/data";

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
  it("marks the year tool as UI-capable and leaves the other nine alone", async () => {
    await connect();
    const { result } = await rpc("tools/list", {}, 2);

    const withUi = result.tools.filter(
      (tool: { _meta?: Record<string, unknown> }) => tool._meta?.ui ?? tool._meta?.["ui/resourceUri"],
    );

    // The promise of this slice: exactly one tool grew a widget, and the rest of
    // the tool set is untouched for every client, UI-capable or not.
    expect(result.tools).toHaveLength(10);
    expect(withUi.map((t: { name: string }) => t.name)).toEqual(["get_vitamin_d_year"]);
    expect(withUi[0]._meta.ui).toMatchObject({ resourceUri: YEAR_STRIP_RESOURCE_URI });
  });

  it("serves the widget as one self-contained document", async () => {
    await connect();
    const { result } = await rpc("resources/read", { uri: YEAR_STRIP_RESOURCE_URI }, 3);

    expect(result.contents[0].mimeType).toBe(RESOURCE_MIME_TYPE);
    expect(result.contents[0].text).toMatch(/^<!doctype html>/i);
    expect(result.contents[0].text).not.toMatch(/<script[^>]+src=/i);
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
});
