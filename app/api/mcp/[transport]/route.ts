import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { searchCity, sunTimesTool, vitaminDWindowTool, currentStatusTool } from "@/lib/mcp-tools";

/**
 * Remote MCP server: lets users connect the app to Claude, ChatGPT or any MCP
 * client and ask "when can I make vitamin D today?" in natural language.
 * Streamable HTTP endpoint at /api/mcp/mcp (stateless — no Redis, so the SSE
 * transport is not offered). All tools are public read-only calculations; no
 * auth, no user data, no secrets involved.
 */

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

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

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "search_city",
      "Find a city in the app's database by name (any of the app's six languages works) and get its coordinates, IANA timezone and elevation — feed those into the other tools.",
      { query: z.string().min(1).max(80).describe("City name, e.g. 'Madrid', 'London', 'Nueva York'") },
      async ({ query }) => json({ results: searchCity(query) }),
    );

    server.tool(
      "get_sun_times",
      "Sunrise, sunset, solar noon, civil dawn/dusk, evening golden hour and day length (with day-over-day trend) for a location and date. Handles midnight sun and polar night.",
      { lat: LAT, lon: LON, date: DATE, timezone: TZ },
      async (args) => json(sunTimesTool(args)),
    );

    server.tool(
      "get_vitamin_d_window",
      "The daily solar vitamin D synthesis window for a location, date and personal profile: when UV is strong enough (index ≥ 3), the best hour, and the clear-sky minutes of sun needed to reach the target IU. Returns synthesisPossible=false in winter/at high latitudes when the sun never gets high enough.",
      { lat: LAT, lon: LON, date: DATE, timezone: TZ, ...PROFILE },
      async (args) => json(vitaminDWindowTool(args)),
    );

    server.tool(
      "get_current_status",
      "Whether RIGHT NOW is a good moment for vitamin D synthesis at a location, using live Open-Meteo UV/cloud data when reachable (clear-sky model otherwise): current UV index, minutes needed now, and when today's window opens or closes.",
      { lat: LAT, lon: LON, timezone: TZ, ...PROFILE },
      async (args) => json(await currentStatusTool(args)),
    );
  },
  {
    serverInfo: { name: "vitamind-explorer", version: "1.0.0" },
  },
  {
    basePath: "/api/mcp",
    verboseLogs: false,
    maxDuration: 30,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
