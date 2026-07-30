/**
 * The slice of the MCP Apps view protocol this widget actually speaks, over
 * postMessage JSON-RPC: one request out (`ui/initialize`), one notification out
 * (`ui/notifications/initialized`, plus size reports), two notifications in
 * (`tool-result`, `host-context-changed`).
 *
 * Why not the `App` class from `@modelcontextprotocol/ext-apps`: it is built on
 * the MCP SDK's `Protocol`, which validates every message with zod. Bundling that
 * chain cost 242 KB of a 305 KB widget — forty times the widget itself — and the
 * whole thing ships inline inside the `ui://` resource on every `resources/read`.
 * The surface above is small enough to speak directly.
 *
 * The trade-off is that we now own the handshake, so it must not drift:
 * `MCP_UI_PROTOCOL_VERSION` is pinned by a test against the constant the package
 * exports, which turns a silent protocol change into a failing build.
 *
 * Kept dependency-free on purpose — anything imported here is shipped to the
 * iframe. Types are `import type` only, so they cost nothing at runtime.
 */

/** Protocol version. Pinned to ext-apps' LATEST_PROTOCOL_VERSION by test. */
export const MCP_UI_PROTOCOL_VERSION = "2026-01-26";

const INITIALIZE = "ui/initialize";
const INITIALIZED = "ui/notifications/initialized";
const TOOL_RESULT = "ui/notifications/tool-result";
const HOST_CONTEXT_CHANGED = "ui/notifications/host-context-changed";
const SIZE_CHANGED = "ui/notifications/size-changed";

export interface HostContext {
  theme?: "light" | "dark";
  locale?: string;
  styles?: { variables?: Record<string, string | undefined> };
  [key: string]: unknown;
}

/** How messages reach the host. Injectable so the handshake is testable. */
export interface BridgeTransport {
  post(message: unknown): void;
  /** Registers a handler for inbound messages; returns an unsubscribe function. */
  subscribe(handler: (message: unknown) => void): () => void;
}

/**
 * postMessage transport against the embedding host.
 *
 * `event.source !== target` is dropped: an iframe can receive messages from
 * anyone, and the host is the only party allowed to drive this widget.
 */
export function windowTransport(target: Window = window.parent): BridgeTransport {
  return {
    post: (message) => target.postMessage(message, "*"),
    subscribe: (handler) => {
      const listener = (event: MessageEvent) => {
        if (event.source !== target) return;
        handler(event.data);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
  };
}

export interface HostBridgeOptions {
  appInfo: { name: string; version: string };
  transport: BridgeTransport;
  appCapabilities?: Record<string, unknown>;
  onToolResult?: (result: unknown) => void;
  onHostContextChanged?: (context: HostContext) => void;
  /** Guards against a host that never answers the handshake. */
  requestTimeoutMs?: number;
}

interface Pending {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export class HostBridge {
  private readonly options: HostBridgeOptions;
  private readonly pending = new Map<number, Pending>();
  private unsubscribe: (() => void) | null = null;
  private nextId = 1;
  private hostContext: HostContext | undefined;
  private ready = false;

  constructor(options: HostBridgeOptions) {
    this.options = options;
  }

  /** Runs the handshake: initialize, then announce we are initialized. */
  async connect(): Promise<void> {
    if (this.unsubscribe) throw new Error("HostBridge is already connected");
    this.unsubscribe = this.options.transport.subscribe((message) => this.handle(message));

    const result = await this.request(INITIALIZE, {
      appInfo: this.options.appInfo,
      appCapabilities: this.options.appCapabilities ?? {},
      protocolVersion: MCP_UI_PROTOCOL_VERSION,
    });

    const context = result.hostContext;
    this.hostContext = isRecord(context) ? (context as HostContext) : undefined;
    this.notify(INITIALIZED);
    this.ready = true;
  }

  getHostContext(): HostContext | undefined {
    return this.hostContext;
  }

  /**
   * Reports the rendered height so the host can size the iframe. Silent before
   * the handshake finishes — a host that has not initialized us yet has no frame
   * to resize.
   */
  notifySize(height: number): void {
    if (!this.ready) return;
    this.notify(SIZE_CHANGED, { height });
  }

  /**
   * Calls a tool on the MCP server through the host, without a chat round trip.
   *
   * This is what makes a widget interactive rather than a picture: tapping a day
   * in the history calendar logs it and the calendar updates in place. The host
   * relays it as a normal `tools/call`, so the server sees no difference between
   * this and the model calling the same tool.
   */
  async callServerTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    this.assertConnected("callServerTool");
    return this.request("tools/call", params);
  }

  /**
   * Hands the model something the user did in the widget, so later turns inherit
   * it. Each call replaces the previous context this view sent.
   */
  async updateModelContext(params: {
    content?: unknown[];
    structuredContent?: Record<string, unknown>;
  }): Promise<void> {
    this.assertConnected("updateModelContext");
    await this.request("ui/update-model-context", params);
  }

  /**
   * Anything that talks to the host must wait for the handshake: posting a
   * request before `ui/initialize` has been answered means the host has no
   * record of this view, and the message is dropped with no error anywhere.
   */
  private assertConnected(method: string): void {
    if (!this.ready) throw new Error(`HostBridge is not connected yet — ${method} needs the handshake first`);
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ready = false;
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error("HostBridge closed"));
    }
    this.pending.clear();
  }

  private request(method: string, params: unknown): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeoutMs = this.options.requestTimeoutMs ?? 30_000;
      const timer = timeoutMs > 0
        ? setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`Host did not answer ${method} within ${timeoutMs}ms`));
          }, timeoutMs)
        : null;
      this.pending.set(id, { resolve, reject, timer });
      this.options.transport.post({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params?: unknown): void {
    this.options.transport.post(
      params === undefined
        ? { jsonrpc: "2.0", method }
        : { jsonrpc: "2.0", method, params },
    );
  }

  /**
   * Anything that is not a JSON-RPC 2.0 message we recognise is dropped without
   * throwing: this listener sits on a window that receives traffic we do not own,
   * and a widget that dies on an unexpected frame is worse than one that ignores it.
   */
  private handle(message: unknown): void {
    if (!isRecord(message) || message.jsonrpc !== "2.0") return;

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (isRecord(message.error)) {
        const detail = message.error.message;
        pending.reject(new Error(typeof detail === "string" ? detail : "Host returned an error"));
        return;
      }
      pending.resolve(isRecord(message.result) ? message.result : {});
      return;
    }

    switch (message.method) {
      case TOOL_RESULT:
        this.options.onToolResult?.(message.params);
        return;
      case HOST_CONTEXT_CHANGED: {
        // The spec sends only the fields that changed, so this merges: a theme
        // flip must not erase the locale the strip labels its months with.
        if (!isRecord(message.params)) return;
        this.hostContext = { ...this.hostContext, ...(message.params as HostContext) };
        this.options.onHostContextChanged?.(this.hostContext);
        return;
      }
      default:
        return;
    }
  }
}
