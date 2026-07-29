import { describe, expect, it, vi } from "vitest";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import { initMcpServer } from "../mcp-server";
import { YEAR_STRIP_META_KEY } from "@/widgets/year-strip/data";
import { YEAR_STRIP_WIDGET_HTML } from "@/widgets/year-strip/generated";

describe("get_vitamin_d_year MCP App registration", () => {
  it("advertises and serves its self-contained UI resource", async () => {
    const tools = new Map<string, { config: Record<string, unknown>; callback: (args: never) => Promise<unknown> }>();
    const resources = new Map<string, { callback: () => Promise<{ contents: Array<Record<string, unknown>> }> }>();
    const server = {
      tool: vi.fn(),
      registerTool: vi.fn((name, config, callback) => tools.set(name, { config, callback })),
      registerResource: vi.fn((name, uri, config, callback) => resources.set(String(uri), { callback })),
    };

    initMcpServer(server as never);

    const year = tools.get("get_vitamin_d_year");
    expect(year?.config._meta).toMatchObject({
      ui: { resourceUri: "ui://getvitamind/year-strip.html" },
      "ui/resourceUri": "ui://getvitamind/year-strip.html",
    });

    const resource = resources.get("ui://getvitamind/year-strip.html");
    const read = await resource!.callback();
    expect(read.contents[0]).toMatchObject({
      uri: "ui://getvitamind/year-strip.html",
      mimeType: RESOURCE_MIME_TYPE,
      text: YEAR_STRIP_WIDGET_HTML,
    });
  });

  it("returns unchanged model text plus private chart metadata", async () => {
    let callback: ((args: never) => Promise<{ content: Array<{ text: string }>; _meta: Record<string, unknown> }>) | undefined;
    const server = {
      tool: vi.fn(),
      registerTool: vi.fn((name, _config, cb) => { if (name === "get_vitamin_d_year") callback = cb; }),
      registerResource: vi.fn(),
    };
    initMcpServer(server as never);

    const result = await callback!({ lat: 51.51, lon: -0.13, timezone: "Europe/London" } as never);
    expect(result.content[0].text).not.toContain("hoursByDay");
    expect(result._meta[YEAR_STRIP_META_KEY]).toMatchObject({ hoursByDay: expect.any(Array) });
    expect((result._meta[YEAR_STRIP_META_KEY] as { hoursByDay: number[] }).hoursByDay).toHaveLength(365);
  });
});
