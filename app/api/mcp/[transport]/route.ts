import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { initMcpServer, verifyToken, SERVER_INFO } from "@/lib/mcp-server";

/**
 * PUBLIC MCP endpoint (/api/mcp/mcp): auth is optional, so the calculation
 * tools work with no account at all. Because this endpoint never returns 401,
 * MCP clients will not initiate the OAuth flow here — users who want the
 * personal tools connect the account endpoint (/api/mcp-auth/mcp) instead.
 */
const handler = createMcpHandler(
  initMcpServer,
  { serverInfo: SERVER_INFO },
  { basePath: "/api/mcp", verboseLogs: false, maxDuration: 30 },
);

const authHandler = withMcpAuth(handler, verifyToken, { required: false });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
