import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { OAUTH_SCOPES } from "@/lib/oauth";

/**
 * RFC 8414 authorization server metadata. The origin is derived per request
 * (via proxy headers) so the same code serves getvitamind.app and the dev
 * preview without configuration.
 */
export async function GET(request: Request) {
  const origin = getPublicOrigin(request);
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...OAUTH_SCOPES],
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
