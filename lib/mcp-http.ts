import type { AuthInfo } from "@modelcontextprotocol/server";

// Match the SDK's HTTP body policy before mcp-handler clones/parses the JSON.
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;

function tooLarge() {
  return Response.json({
    jsonrpc: "2.0", id: null,
    error: { code: -32000, message: `Payload Too Large: Request body must not exceed ${MAX_JSON_BODY_BYTES} bytes` },
  }, { status: 413 });
}

/** Mount inside withMcpAuth so an account challenge never reads the body. */
export function withMcpBodyLimit(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    // Cover every content type mcp-handler attempts to parse, even malformed ones.
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (request.method !== "POST" || !contentType.includes("application/json")) return handler(request);

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
      await request.body?.cancel().catch(() => undefined);
      return tooLarge();
    }
    if (!request.body) return handler(request);

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_JSON_BODY_BYTES) {
          await reader.cancel().catch(() => undefined);
          return tooLarge();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    // Next proxies NextRequest. Passing that Proxy to Request's constructor
    // accesses native private slots and throws on Node 24. Copy public fields
    // instead; withMcpAuth's verified identity also needs carrying explicitly.
    const bounded = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      signal: request.signal,
      body,
    });
    const authenticated = request as Request & { auth?: AuthInfo };
    Object.assign(bounded, { auth: authenticated.auth });
    return handler(bounded);
  };
}
