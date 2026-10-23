import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { initMcpServer, verifyToken, SERVER_INFO } from "@/lib/mcp-server";

/**
 * PUBLIC MCP endpoint (/api/mcp/mcp): auth is optional, so the calculation
 * tools work with no account at all. Because this endpoint never returns 401,
 * MCP clients will not initiate the OAuth flow here — users who want the
 * personal tools connect the account endpoint (/api/mcp-auth/mcp) instead.
 */
// SDK input traversal limits are opt-in; ordinary tool payloads are small.
const handlerOptions: NonNullable<Parameters<typeof createMcpHandler>[1]> & { maxToolInputElements: number } = {
  serverInfo: SERVER_INFO, verboseLogs: false, maxSubscriptions: 0, maxToolInputElements: 10000,
};
const handler = createMcpHandler(
  initMcpServer,
  handlerOptions,
);

const authHandler = withMcpAuth(handler, verifyToken, { required: false });

// Keep the existing stateless endpoint; the SDK no longer owns path routing.
export const maxDuration = 30;
const routeHandler = (request: Request) => new URL(request.url).pathname === "/api/mcp/mcp"
  ? authHandler(request)
  : Promise.resolve(new Response(null, { status: 404 }));

export { routeHandler as GET, routeHandler as POST, routeHandler as DELETE };
