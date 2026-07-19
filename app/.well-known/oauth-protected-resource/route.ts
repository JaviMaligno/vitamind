import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { OAUTH_SCOPES } from "@/lib/oauth";

/** RFC 9728 protected resource metadata. The protected resource is the
 *  ACCOUNT endpoint — the public /api/mcp/mcp never challenges for auth. */
export async function GET(request: Request) {
  const origin = getPublicOrigin(request);
  return Response.json({
    resource: `${origin}/api/mcp-auth/mcp`,
    authorization_servers: [origin],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
