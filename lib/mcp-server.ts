import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import {
  searchCity, sunTimesTool, vitaminDWindowTool, vitaminDYearTool, currentStatusTool,
} from "@/lib/mcp-tools";
import { getOAuthDb, verifyAccessToken, type OAuthScope } from "@/lib/oauth";
import {
  getProfileStore, myProfileTool, myCitiesTool, myHistoryTool, logSunSessionTool,
} from "@/lib/mcp-personal";

/**
 * Remote MCP server: lets users connect the app to Claude, ChatGPT or any MCP
 * client and ask "when can I make vitamin D today?" in natural language.
 * Streamable HTTP endpoint at /api/mcp/mcp (stateless — no Redis, so the SSE
 * transport is not offered).
 *
 * Two tiers: the public calculation tools work with no auth at all (that must
 * never regress), while the get_my_* / log_* tools require an OAuth 2.1 token
 * from this app's authorization server (see lib/oauth.ts) and answer only for
 * the token's own user.
 */

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

type ToolResult = ReturnType<typeof json>;

/** Wraps a personal tool: requires a verified token with the given scope. */
function personal<A>(
  tool: string,
  scope: OAuthScope,
  run: (userId: string, args: A) => Promise<ToolResult>,
) {
  return async (args: A, extra: { authInfo?: AuthInfo }): Promise<ToolResult> => {
    const auth = extra.authInfo;
    const userId = (auth?.extra as { userId?: string } | undefined)?.userId;
    if (!userId) {
      return json({
        error: "authentication_required",
        hint: "This tool needs the user's Vitamin D account. Reconnect the MCP server using OAuth (the connector will offer a login) to enable personal tools.",
      });
    }
    if (!auth!.scopes.includes(scope)) {
      return json({ error: "insufficient_scope", requiredScope: scope });
    }
    return timed(tool, () => run(userId, args));
  };
}

/** Usage log: tool name + duration only — never arguments (they carry the
 *  caller's location). Enough to spot which tools get used and which cascade. */
async function timed<T>(tool: string, run: () => T | Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await run();
  } finally {
    console.log(`[api/mcp] ${tool} ${Date.now() - t0}ms`);
  }
}

const LAT = z.number().min(-90).max(90).describe("Latitude in decimal degrees");
const LON = z.number().min(-180).max(180).describe("Longitude in decimal degrees");
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  .describe("Date as YYYY-MM-DD; defaults to today");
const TZ = z.string().max(64).optional()
  .describe("IANA timezone like 'Europe/Madrid'. Strongly recommended — without it all times are UTC");

const PROFILE = {
  skinType: z.number().int().min(1).max(6).optional()
    .describe("Fitzpatrick skin type 1 (very fair) to 6 (very dark); default 3"),
  exposedSkinFraction: z.number().min(0.05).max(1).optional()
    .describe("Skin exposed: 0.10 face+hands, 0.18 face+arms, 0.25 t-shirt+shorts (default), 0.40 swimsuit"),
  age: z.number().min(0).max(120).optional()
    .describe("Age in years (synthesis declines with age); omit for adult baseline"),
  targetIU: z.number().min(100).max(10000).optional()
    .describe("Vitamin D target per session in IU; default 1000"),
  elevationM: z.number().min(-100).max(6000).optional()
    .describe("Ground elevation in metres (UV rises ~8%/km); default sea level"),
};

export const SERVER_INFO = { name: "vitamind-explorer", version: "1.0.0" };

/** Registers the full tool set (public + personal) on an MCP server. */
export function initMcpServer(server: McpServer) {
    server.tool(
      "search_city",
      "Find a city in the app's database by name (any of the app's six languages works) and get its coordinates, IANA timezone and elevation — feed those into the other tools.",
      { query: z.string().min(1).max(80).describe("City name, e.g. 'Madrid', 'London', 'Nueva York'") },
      async ({ query }) => timed("search_city", () => json({ results: searchCity(query) })),
    );

    server.tool(
      "get_sun_times",
      "Sunrise, sunset, solar noon, civil dawn/dusk, evening golden hour and day length (with day-over-day trend) for a location and date. Handles midnight sun and polar night.",
      { lat: LAT, lon: LON, date: DATE, timezone: TZ },
      async (args) => timed("get_sun_times", () => json(sunTimesTool(args))),
    );

    server.tool(
      "get_vitamin_d_window",
      "The solar vitamin D synthesis window for ONE specific day at a location, for a personal profile: when UV is strong enough (index ≥ 3), the best hour, and the clear-sky minutes of sun needed to reach the target IU. Returns synthesisPossible=false when the sun never gets high enough that day. Only for single-day questions — for months, seasons or 'when during the year', call get_vitamin_d_year instead of calling this once per date.",
      { lat: LAT, lon: LON, date: DATE, timezone: TZ, ...PROFILE },
      async (args) => timed("get_vitamin_d_window", () => json(vitaminDWindowTool(args))),
    );

    server.tool(
      "get_vitamin_d_year",
      "The WHOLE YEAR of solar vitamin D for a location in a single call: which months synthesis is possible, the exact first/last viable days of the season, and per-month windows with the minutes needed for a personal profile. Use this for any question about months, seasons, winter/summer or 'when during the year can I…' — never probe individual dates with get_vitamin_d_window for that.",
      { lat: LAT, lon: LON, timezone: TZ, ...PROFILE },
      async (args) => timed("get_vitamin_d_year", () => json(vitaminDYearTool(args))),
    );

    server.tool(
      "get_current_status",
      "Whether RIGHT NOW is a good moment for vitamin D synthesis at a location, using live Open-Meteo UV/cloud data when reachable (clear-sky model otherwise): current UV index, minutes needed now, and when today's window opens or closes.",
      { lat: LAT, lon: LON, timezone: TZ, ...PROFILE },
      async (args) => timed("get_current_status", async () => json(await currentStatusTool(args))),
    );

    // ------------------------------------------------------------------
    // Personal tools (OAuth). Registered unconditionally so clients can
    // discover them; without a token they return authentication_required.

    const store = () => {
      const s = getProfileStore();
      if (!s) throw new Error("profile store unavailable");
      return s;
    };

    server.tool(
      "get_my_profile",
      "The signed-in user's saved Vitamin D profile: skin type, exposed-skin default, age, target IU and their current city. Requires connecting with OAuth (scope profile:read). Call this FIRST for any personal question, then pass its values to the public tools instead of asking the user.",
      {},
      personal("get_my_profile", "profile:read", async (userId) => json(await myProfileTool(store(), userId))),
    );

    server.tool(
      "get_my_cities",
      "The signed-in user's current city and favorite cities with coordinates and timezones, ready to feed into the public tools. Requires OAuth (scope profile:read).",
      {},
      personal("get_my_cities", "profile:read", async (userId) => json(await myCitiesTool(store(), userId))),
    );

    server.tool(
      "get_my_history",
      "The signed-in user's sun history from the app's calendar: which recent days had viable sun, which they confirmed going outside, and their current streak. Requires OAuth (scope history:read).",
      { days: z.number().int().min(1).max(365).optional().describe("How many recent days to return; default 30") },
      personal("get_my_history", "history:read", async (userId, args: { days?: number }) =>
        json(await myHistoryTool(store(), userId, args))),
    );

    server.tool(
      "log_sun_session",
      "Marks a day as sun-confirmed in the signed-in user's history calendar — use when the user says they went (or will have gone) outside for their sun. Defaults to today. Requires OAuth (scope history:write).",
      {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Day to confirm, YYYY-MM-DD; defaults to today"),
        minutes: z.number().min(1).max(600).optional().describe("Minutes the user reports having spent in the sun (acknowledged, not stored)"),
      },
      personal("log_sun_session", "history:write", async (userId, args: { date?: string; minutes?: number }) =>
        json(await logSunSessionTool(store(), userId, args))),
    );
}

/**
 * Bearer verification: our own opaque tokens only (vd_at_…), looked up hashed.
 * Used with required:false on the public endpoint (missing token just means
 * no authInfo) and required:true on the account endpoint (missing token 401s,
 * which is what triggers the OAuth flow in MCP clients).
 */
export async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const db = getOAuthDb();
  if (!db) return undefined;
  const verified = await verifyAccessToken(db, bearer);
  if (!verified) return undefined;
  return {
    token: bearer,
    clientId: verified.clientId,
    scopes: verified.scopes,
    expiresAt: Math.floor(verified.expiresAt / 1000),
    extra: { userId: verified.userId },
  };
}
