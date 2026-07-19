import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { initMcpServer, verifyToken, SERVER_INFO } from "@/lib/mcp-server";

/**
 * ACCOUNT MCP endpoint (/api/mcp-auth/mcp): same tool set as /api/mcp/mcp but
 * auth is REQUIRED. An unauthenticated request gets a 401 with the resource
 * metadata pointer — that 401 is exactly what makes Claude/ChatGPT launch the
 * OAuth login + consent flow, which optional-auth endpoints never trigger.
 */
const handler = createMcpHandler(
  initMcpServer,
  { serverInfo: SERVER_INFO },
  { basePath: "/api/mcp-auth", verboseLogs: false, maxDuration: 30 },
);

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
