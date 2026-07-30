import { describe, expect, it, vi } from "vitest";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/ext-apps";
import { HostBridge, MCP_UI_PROTOCOL_VERSION, type BridgeTransport } from "../host-bridge";

/**
 * A fake host: collects what the widget posts and lets the test push messages
 * back, so the handshake is exercised without a browser or a real client.
 */
interface PostedMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
}

function fakeHost() {
  const posted: PostedMessage[] = [];
  let deliver: ((message: unknown) => void) | null = null;
  const transport: BridgeTransport = {
    post: (message) => posted.push(message as PostedMessage),
    subscribe: (handler) => {
      deliver = handler;
      return () => { deliver = null; };
    },
  };
  return {
    transport,
    posted,
    send: (message: unknown) => deliver?.(message),
    /** Answers the pending ui/initialize the way a host would. */
    respondToInitialize: (hostContext: Record<string, unknown>) => {
      const request = posted.find((m) => m.method === "ui/initialize");
      deliver?.({
        jsonrpc: "2.0",
        id: request?.id,
        result: {
          protocolVersion: MCP_UI_PROTOCOL_VERSION,
          hostInfo: { name: "fake-host", version: "1.0.0" },
          hostCapabilities: {},
          hostContext,
        },
      });
    },
  };
}

const appInfo = { name: "test-widget", version: "1.0.0" };

describe("MCP_UI_PROTOCOL_VERSION", () => {
  it("matches the version the ext-apps package speaks", () => {
    // The whole point of hand-rolling the bridge is bundle size, not divergence:
    // if a package bump moves the protocol, this fails instead of drifting silently.
    expect(MCP_UI_PROTOCOL_VERSION).toBe(LATEST_PROTOCOL_VERSION);
  });
});

describe("HostBridge.connect", () => {
  it("sends ui/initialize and only then notifies initialized", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });

    const connected = bridge.connect();
    const init = host.posted.find((m) => m.method === "ui/initialize");
    expect(init).toBeDefined();
    expect(init?.params).toMatchObject({ appInfo, protocolVersion: MCP_UI_PROTOCOL_VERSION });
    expect(init?.params?.appCapabilities).toBeDefined();
    expect(init?.jsonrpc).toBe("2.0");
    // Nothing else may go out before the host has answered.
    expect(host.posted.map((m) => m.method)).toEqual(["ui/initialize"]);

    host.respondToInitialize({ theme: "dark", locale: "es-ES" });
    await connected;

    expect(host.posted.map((m) => m.method))
      .toEqual(["ui/initialize", "ui/notifications/initialized"]);
  });

  it("exposes the host context from the initialize result", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    const connected = bridge.connect();
    host.respondToInitialize({ theme: "dark", locale: "fr" });
    await connected;

    expect(bridge.getHostContext()).toMatchObject({ theme: "dark", locale: "fr" });
  });

  it("rejects when the host answers with an error", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    const connected = bridge.connect();
    const init = host.posted.find((m) => m.method === "ui/initialize");
    host.send({ jsonrpc: "2.0", id: init?.id, error: { code: -32603, message: "nope" } });

    await expect(connected).rejects.toThrow(/nope/);
  });
});

describe("HostBridge notifications", () => {
  it("hands the whole tool result to the callback, _meta included", async () => {
    const host = fakeHost();
    const onToolResult = vi.fn();
    const bridge = new HostBridge({ appInfo, transport: host.transport, onToolResult });
    const connected = bridge.connect();
    host.respondToInitialize({});
    await connected;

    const result = {
      content: [{ type: "text", text: "{}" }],
      _meta: { "getvitamind/year-strip": { hoursByDay: [1, 2, 3] } },
    };
    host.send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result });

    expect(onToolResult).toHaveBeenCalledWith(result);
  });

  it("MERGES a partial host-context change instead of replacing it", async () => {
    const host = fakeHost();
    const onHostContextChanged = vi.fn();
    const bridge = new HostBridge({ appInfo, transport: host.transport, onHostContextChanged });
    const connected = bridge.connect();
    host.respondToInitialize({ theme: "light", locale: "lt" });
    await connected;

    // The spec says host-context-changed carries only the changed fields, so a
    // theme flip must not wipe the locale the strip renders its labels with.
    host.send({
      jsonrpc: "2.0",
      method: "ui/notifications/host-context-changed",
      params: { theme: "dark" },
    });

    expect(bridge.getHostContext()).toMatchObject({ theme: "dark", locale: "lt" });
    expect(onHostContextChanged).toHaveBeenCalledTimes(1);
  });

  it("survives junk: non-JSON-RPC payloads and unknown methods", async () => {
    const host = fakeHost();
    const onToolResult = vi.fn();
    const bridge = new HostBridge({ appInfo, transport: host.transport, onToolResult });
    const connected = bridge.connect();
    host.respondToInitialize({ theme: "light" });
    await connected;

    expect(() => {
      host.send("hello");
      host.send(null);
      host.send({ some: "object" });
      host.send({ jsonrpc: "1.0", method: "ui/notifications/tool-result", params: {} });
      host.send({ jsonrpc: "2.0", method: "ui/notifications/unheard-of", params: {} });
      host.send({ jsonrpc: "2.0", id: 999, result: {} });
    }).not.toThrow();

    expect(onToolResult).not.toHaveBeenCalled();
    expect(bridge.getHostContext()).toMatchObject({ theme: "light" });
  });
});

describe("HostBridge.notifySize", () => {
  it("reports height with the spec's method and params", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    const connected = bridge.connect();
    host.respondToInitialize({});
    await connected;

    bridge.notifySize(240);

    expect(host.posted.at(-1)).toEqual({
      jsonrpc: "2.0",
      method: "ui/notifications/size-changed",
      params: { height: 240 },
    });
  });

  it("stays quiet before the handshake completes", () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });

    bridge.notifySize(240);

    expect(host.posted).toEqual([]);
  });
});

describe("HostBridge.callServerTool", () => {
  it("forwards a tools/call over the same channel and resolves with the result", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    const connected = bridge.connect();
    host.respondToInitialize({});
    await connected;

    const pending = bridge.callServerTool({ name: "log_sun_session", arguments: { date: "2026-07-30" } });
    const sent = host.posted.at(-1)!;
    expect(sent.method).toBe("tools/call");
    expect(sent.params).toEqual({ name: "log_sun_session", arguments: { date: "2026-07-30" } });

    host.send({ jsonrpc: "2.0", id: sent.id, result: { content: [{ type: "text", text: "ok" }] } });
    await expect(pending).resolves.toMatchObject({ content: [{ type: "text", text: "ok" }] });
  });

  it("refuses before the handshake, rather than posting into the void", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });

    await expect(bridge.callServerTool({ name: "log_sun_session" })).rejects.toThrow(/not connected/i);
    expect(host.posted).toEqual([]);
  });

  it("surfaces a tool error to the caller instead of resolving", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    const connected = bridge.connect();
    host.respondToInitialize({});
    await connected;

    const pending = bridge.callServerTool({ name: "nope" });
    const sent = host.posted.at(-1)!;
    host.send({ jsonrpc: "2.0", id: sent.id, error: { code: -32602, message: "unknown tool" } });

    await expect(pending).rejects.toThrow(/unknown tool/);
  });
});

describe("HostBridge.updateModelContext", () => {
  it("sends the structured context the model should inherit", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    const connected = bridge.connect();
    host.respondToInitialize({});
    await connected;

    const pending = bridge.updateModelContext({
      content: [{ type: "text", text: "Skin type 2, 25% exposed" }],
      structuredContent: { skinType: 2, exposedSkinFraction: 0.25 },
    });
    const sent = host.posted.at(-1)!;
    expect(sent.method).toBe("ui/update-model-context");
    expect(sent.params).toMatchObject({ structuredContent: { skinType: 2 } });

    host.send({ jsonrpc: "2.0", id: sent.id, result: {} });
    await expect(pending).resolves.toBeUndefined();
  });

  it("refuses before the handshake", async () => {
    const host = fakeHost();
    const bridge = new HostBridge({ appInfo, transport: host.transport });
    await expect(bridge.updateModelContext({ structuredContent: {} })).rejects.toThrow(/not connected/i);
  });
});
