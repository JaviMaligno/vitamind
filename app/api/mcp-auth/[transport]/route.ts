import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { initMcpServer, verifyToken, SERVER_INFO } from "@/lib/mcp-server";
import { withMcpBodyLimit } from "@/lib/mcp-http";

/**
 * ACCOUNT MCP endpoint (/api/mcp-auth/mcp): same tool set as /api/mcp/mcp but
 * auth is REQUIRED. An unauthenticated request gets a 401 with the resource
 * metadata pointer — that 401 is exactly what makes Claude/ChatGPT launch the
 * OAuth login + consent flow, which optional-auth endpoints never trigger.
 */
// SDK input traversal limits are opt-in; ordinary tool payloads are small.
const handlerOptions: NonNullable<Parameters<typeof createMcpHandler>[1]> & { maxToolInputElements: number } = {
  serverInfo: SERVER_INFO, verboseLogs: false, maxSubscriptions: 0, maxToolInputElements: 10000,
};
const handler = createMcpHandler(
  initMcpServer,
  handlerOptions,
);

const authHandler = withMcpAuth(withMcpBodyLimit(handler), verifyToken, { required: true });

// Keep the existing stateless endpoint; the SDK no longer owns path routing.
export const maxDuration = 30;
const routeHandler = (request: Request) => new URL(request.url).pathname === "/api/mcp-auth/mcp"
  ? authHandler(request)
  : Promise.resolve(new Response(null, { status: 404 }));

export { routeHandler as GET, routeHandler as POST, routeHandler as DELETE };
