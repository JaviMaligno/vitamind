import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { OAUTH_SCOPES } from "@/lib/oauth";

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export async function GET(request: Request) {
  const origin = getPublicOrigin(request);
  return Response.json({
    resource: `${origin}/api/mcp/mcp`,
    authorization_servers: [origin],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
