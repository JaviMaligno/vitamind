import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  searchCity, sunTimesTool, vitaminDWindowTool, vitaminDYearFull, currentStatusFull,
  compareVitaminDYearFull, configureSunProfileFull, sunForecastFull, estimateSunSessionTool,
} from "@/lib/mcp-tools";
import { YEAR_STRIP_META_KEY } from "@/widgets/year-strip/data";
import { YEAR_STRIP_WIDGET_HTML } from "@/widgets/year-strip/generated";
import { DAY_CURVE_META_KEY } from "@/widgets/day-curve/data";
import { DAY_CURVE_WIDGET_HTML } from "@/widgets/day-curve/generated";
import { PROFILE_META_KEY } from "@/widgets/profile/data";
import { PROFILE_WIDGET_HTML } from "@/widgets/profile/generated";
import { HISTORY_META_KEY } from "@/widgets/history/data";
import { HISTORY_WIDGET_HTML } from "@/widgets/history/generated";
import { FORECAST_META_KEY } from "@/widgets/forecast/data";
import { FORECAST_WIDGET_HTML } from "@/widgets/forecast/generated";
import { getOAuthDb, verifyAccessToken, type OAuthScope } from "@/lib/oauth";
import {
  getProfileStore, myProfileTool, myCitiesTool, myHistoryTool, logSunSessionTool, updateMyProfileTool,
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

/** What a tool handler returns: the model-facing text, plus the optional
 *  `_meta` channel a widget renders from. */
type ToolResult = ReturnType<typeof json> & { _meta?: Record<string, unknown> };

/**
 * Wraps a personal tool: requires a verified token with the given scope.
 *
 * `run` returns the raw payload rather than a formatted result so this wrapper
 * can both serialise it and, for tools that carry a widget, derive the chart
 * channel from it — including on the unauthenticated path, where the widget
 * still has to render something honest instead of a blank frame.
 */
function personal<A>(
  tool: string,
  scope: OAuthScope,
  run: (userId: string, args: A) => Promise<unknown>,
  meta?: (payload: unknown, authenticated: boolean) => Record<string, unknown> | undefined,
) {
  const wrap = (payload: unknown, authenticated: boolean): ToolResult => {
    const built = meta?.(payload, authenticated);
    return built ? { ...json(payload), _meta: built } : json(payload);
  };

  return async (args: A, extra: { authInfo?: AuthInfo }): Promise<ToolResult> => {
    const auth = extra.authInfo;
    const userId = (auth?.extra as { userId?: string } | undefined)?.userId;
    if (!userId) {
      return wrap({
        error: "authentication_required",
        hint: "This tool needs the user's Vitamin D account. Reconnect the MCP server using OAuth (the connector will offer a login) to enable personal tools.",
      }, false);
    }
    if (!auth!.scopes.includes(scope)) {
      return wrap({ error: "insufficient_scope", requiredScope: scope }, false);
    }
    return timed(tool, async () => wrap(await run(userId, args), true));
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
export const YEAR_STRIP_RESOURCE_URI = "ui://getvitamind/year-strip.html";
export const DAY_CURVE_RESOURCE_URI = "ui://getvitamind/day-curve.html";
export const PROFILE_RESOURCE_URI = "ui://getvitamind/profile.html";
export const HISTORY_RESOURCE_URI = "ui://getvitamind/history.html";
export const FORECAST_RESOURCE_URI = "ui://getvitamind/forecast.html";

/**
 * Chart channel for the history widget, derived from whatever the tool answered
 * — including the authentication_required payload, so the widget can say "connect
 * your account" instead of drawing an empty year.
 */
function historyChartMeta(payload: unknown, authenticated: boolean) {
  const p = (payload ?? {}) as Record<string, unknown>;
  const records = Array.isArray(p.records) ? p.records : [];
  return {
    [HISTORY_META_KEY]: {
      authenticated: authenticated && !p.error,
      days: records.map((r) => {
        const rec = r as Record<string, unknown>;
        return {
          date: rec.date,
          viableSun: rec.viableSun === true,
          // Passed through as three values, not coerced: "stayed in" and "never
          // said" are different answers and the widget draws them differently.
          wentOutside: rec.wentOutside === true ? true : rec.wentOutside === false ? false : null,
        };
      }),
      streak: typeof p.currentConfirmedStreak === "number" ? p.currentConfirmedStreak : 0,
      daysTracked: typeof p.daysTracked === "number" ? p.daysTracked : records.length,
      // The calendar window, so the grid can draw the days with no record — the
      // majority of them, for anyone who does not open the app daily.
      from: typeof p.from === "string" ? p.from : null,
      to: typeof p.to === "string" ? p.to : null,
    },
  };
}

/** Registers the full tool set (public + personal) on an MCP server. */
export function initMcpServer(server: McpServer) {
    registerAppResource(
      server,
      "Vitamin D year strip",
      YEAR_STRIP_RESOURCE_URI,
      { description: "Daily viable vitamin D sunlight across a year" },
      async () => ({
        contents: [{
          uri: YEAR_STRIP_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: YEAR_STRIP_WIDGET_HTML,
          _meta: { ui: { csp: {} } },
        }],
      }),
    );

    registerAppResource(
      server,
      "Vitamin D day curve",
      DAY_CURVE_RESOURCE_URI,
      { description: "Today's sun elevation curve with the vitamin D window shaded" },
      async () => ({
        contents: [{
          uri: DAY_CURVE_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: DAY_CURVE_WIDGET_HTML,
          _meta: { ui: { csp: {} } },
        }],
      }),
    );

    server.tool(
      "search_city",
      "Find a city in the app's database by name (any of the app's six languages works) and get its coordinates, IANA timezone and elevation — feed those into the other tools.",
      { query: z.string().min(1).max(80).describe("City name, e.g. 'Madrid', 'London', 'Nueva York'") },
      async ({ query }) =>
        timed("search_city", () => {
          const results = searchCity(query);
          return json(
            results.length > 0
              ? { results }
              : {
                  results,
                  hint: "Not in the built-in DB (~80 major cities). Every other tool accepts raw lat/lon (plus an IANA timezone) directly — use coordinates you know, or the nearest listed city.",
                },
          );
        }),
    );

    server.tool(
      "get_sun_times",
      "Sunrise, sunset, solar noon, civil dawn/dusk, morning AND evening golden hour, and day length (with day-over-day trend) for a location and date. Handles midnight sun and polar night. Pure sun times — for vitamin D questions use the vitamin_d tools instead.",
      { lat: LAT, lon: LON, date: DATE, timezone: TZ },
      async (args) => timed("get_sun_times", () => json(sunTimesTool(args))),
    );

    server.tool(
      "get_vitamin_d_window",
      "The solar vitamin D synthesis window for ONE specific day at a location, for a personal profile: when UV is strong enough (index ≥ 3), the best hour, the clear-sky minutes needed to reach the target IU, and (with atTime) the minutes at the specific hour the user plans to go out. Returns synthesisPossible=false when the sun never gets high enough that day. Only for single-day questions — for months, seasons or 'when during the year', call get_vitamin_d_year instead of calling this once per date.",
      {
        lat: LAT, lon: LON, date: DATE, timezone: TZ, ...PROFILE,
        atTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional()
          .describe("Local HH:MM the user plans to go out — adds minutesNeeded and UV at that exact time"),
      },
      async (args) => timed("get_vitamin_d_window", () => json(vitaminDWindowTool(args))),
    );

    registerAppTool(
      server,
      "get_vitamin_d_year",
      {
        description: "The WHOLE YEAR of solar vitamin D for a location in a single call. monthsWithSun lists every month with at least one viable day (season edges count as partial months, see byMonth[].viableDays); solidMonths lists months where most days work; exactViableSpan gives the exact season boundaries; summary carries per-year aggregates for comparing places. Use this for any question about months, seasons, winter/summer or 'when during the year can I…' — never probe individual dates with get_vitamin_d_window for that.",
        inputSchema: {
          lat: LAT, lon: LON, timezone: TZ, ...PROFILE,
          placeName: z.string().min(1).max(60).optional()
            .describe("The place's name as the user said it — used to caption the chart"),
        },
        _meta: { ui: { resourceUri: YEAR_STRIP_RESOURCE_URI } },
      },
      async (args) => timed("get_vitamin_d_year", () => {
        const result = vitaminDYearFull(args);
        return {
          ...json(result.text),
          // The strip alone makes the reader decode a picture to get an answer
          // they asked in words. The span and the month count let the widget put
          // the answer above it, using the app's own verdict copy (#29).
          _meta: {
            [YEAR_STRIP_META_KEY]: {
              hoursByDay: result.hoursByDay,
              name: args.placeName,
              spanStart: result.text.exactViableSpan?.firstDay,
              spanEnd: result.text.exactViableSpan?.lastDay,
              allYear: result.text.allYear,
              neverPossible: result.text.neverPossible,
              monthsWithSun: result.text.monthsWithSun.length,
            },
          },
        };
      }),
    );

    registerAppResource(
      server,
      "Sun forecast",
      FORECAST_RESOURCE_URI,
      { description: "The next few days of usable sun, best day first" },
      async () => ({
        contents: [{
          uri: FORECAST_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: FORECAST_WIDGET_HTML,
          _meta: { ui: { csp: {} } },
        }],
      }),
    );

    registerAppResource(
      server,
      "Sun history calendar",
      HISTORY_RESOURCE_URI,
      { description: "The signed-in user's recent sun days, tappable to confirm" },
      async () => ({
        contents: [{
          uri: HISTORY_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: HISTORY_WIDGET_HTML,
          _meta: { ui: { csp: {} } },
        }],
      }),
    );

    registerAppResource(
      server,
      "Sun profile picker",
      PROFILE_RESOURCE_URI,
      { description: "Interactive skin type, exposure, age and target picker" },
      async () => ({
        contents: [{
          uri: PROFILE_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: PROFILE_WIDGET_HTML,
          _meta: { ui: { csp: {} } },
        }],
      }),
    );

    registerAppTool(
      server,
      "configure_sun_profile",
      {
        description: "Show the user an interactive form for the four values every other tool assumes — Fitzpatrick skin type, fraction of skin exposed, age and target IU — with the minutes they need updating live. Use this when those values are unknown, when the user wants to change them, or instead of asking for them one at a time in conversation. Whatever the user picks comes back into the conversation; pass those values explicitly to the other tools afterwards.",
        inputSchema: {
          lat: z.number().min(-90).max(90).optional().describe("Latitude of the place being discussed, so the live estimate uses today's real UV there"),
          lon: z.number().min(-180).max(180).optional().describe("Longitude, paired with lat"),
          timezone: TZ,
          placeName: z.string().min(1).max(60).optional().describe("How to label that place in the widget"),
          skinType: PROFILE.skinType,
          exposedSkinFraction: PROFILE.exposedSkinFraction,
          age: PROFILE.age,
          targetIU: PROFILE.targetIU,
        },
        _meta: { ui: { resourceUri: PROFILE_RESOURCE_URI } },
      },
      async (args, extra: { authInfo?: AuthInfo }) => timed("configure_sun_profile", () => {
        const result = configureSunProfileFull(args);
        // Whether the form can persist depends on the connection, not the tool:
        // the public endpoint carries no token, so the widget must know to stay
        // context-only rather than offering a Save that would fail.
        const canSave = extra.authInfo?.scopes.includes("profile:write") === true;
        return {
          ...json({ ...result.text, savesToAccount: canSave }),
          _meta: { [PROFILE_META_KEY]: { ...result.chart, canSave } },
        };
      }),
    );

    registerAppTool(
      server,
      "get_sun_forecast",
      {
        description: "The NEXT FEW DAYS of vitamin D sun at a location, using the live Open-Meteo forecast: per day the peak UV, average cloud cover, the synthesis window and the minutes needed, plus bestDay. Use this for any question spanning several days — 'which day this week should I go out', 'will it be better tomorrow', 'when's my next chance' — instead of calling get_vitamin_d_window once per date.",
        inputSchema: {
          lat: LAT, lon: LON, timezone: TZ, ...PROFILE,
          days: z.number().int().min(2).max(7).optional()
            .describe("How many days ahead, 2 to 7; default 5"),
        },
        _meta: { ui: { resourceUri: FORECAST_RESOURCE_URI } },
      },
      async (args) => timed("get_sun_forecast", async () => {
        const result = await sunForecastFull(args);
        return result.chart
          ? { ...json(result.text), _meta: { [FORECAST_META_KEY]: result.chart } }
          : json(result.text);
      }),
    );

    registerAppTool(
      server,
      "compare_vitamin_d_year",
      {
        description: "Compare the vitamin D year of 2 to 5 places side by side in ONE call — 'Madrid vs Berlin vs Oslo, where do I actually get winter sun?'. Returns each place's months with sun, exact season span and viable days per year, plus rankedByViableDays. Use this instead of calling get_vitamin_d_year once per city: only this tool can draw the years on a shared axis.",
        inputSchema: {
          places: z.array(z.object({
            name: z.string().min(1).max(60).describe("How to label this place in the comparison"),
            lat: LAT,
            lon: LON,
            timezone: TZ,
            elevationM: PROFILE.elevationM,
          })).min(2).max(5).describe("The places to compare, 2 to 5"),
          skinType: PROFILE.skinType,
          exposedSkinFraction: PROFILE.exposedSkinFraction,
          age: PROFILE.age,
          targetIU: PROFILE.targetIU,
        },
        _meta: { ui: { resourceUri: YEAR_STRIP_RESOURCE_URI } },
      },
      async (args) => timed("compare_vitamin_d_year", () => {
        const result = compareVitaminDYearFull(args);
        return {
          ...json(result.text),
          _meta: { [YEAR_STRIP_META_KEY]: result.chart },
        };
      }),
    );

    registerAppTool(
      server,
      "get_current_status",
      {
        description: "Whether RIGHT NOW is a good moment for vitamin D synthesis at a location, using live Open-Meteo UV/cloud data when reachable (clear-sky model otherwise): current UV index, minutes needed now, and when today's window opens or closes.",
        inputSchema: { lat: LAT, lon: LON, timezone: TZ, ...PROFILE },
        _meta: { ui: { resourceUri: DAY_CURVE_RESOURCE_URI } },
      },
      async (args) => timed("get_current_status", async () => {
        const result = await currentStatusFull(args);
        return {
          ...json(result.text),
          _meta: { [DAY_CURVE_META_KEY]: result.chart },
        };
      }),
    );

    server.tool(
      "estimate_sun_session",
      "Estimate a sun session's outcome: 'I was (or will be) out N minutes — how much vitamin D did I make?' plus 'how long before I'd burn?' for the profile. Takes a start time (defaults to the day's best hour) and session minutes; returns estimated IU (with the physiological cap), average UV and clear-sky minutes-to-sunburn. Use for any 'how much did I get / can I get in X minutes' or 'how long without burning' question.",
      {
        lat: LAT, lon: LON, date: DATE, timezone: TZ,
        skinType: PROFILE.skinType,
        exposedSkinFraction: PROFILE.exposedSkinFraction,
        age: PROFILE.age,
        elevationM: PROFILE.elevationM,
        startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional()
          .describe("Local HH:MM the session starts; defaults to the day's best hour"),
        minutes: z.number().min(1).max(600).describe("Session length in minutes"),
      },
      async (args) => timed("estimate_sun_session", () => json(estimateSunSessionTool(args))),
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
      personal("get_my_profile", "profile:read", (userId) => myProfileTool(store(), userId)),
    );

    server.tool(
      "get_my_cities",
      "The signed-in user's current city and favorite cities with coordinates and timezones, ready to feed into the public tools. Requires OAuth (scope profile:read).",
      {},
      personal("get_my_cities", "profile:read", (userId) => myCitiesTool(store(), userId)),
    );

    server.tool(
      "update_my_profile",
      "Save the signed-in user's synthesis profile — skin type, exposed-skin fraction, age and target IU — to their account, so the app and every later call use them. Requires OAuth (scope profile:write). Only these four values are writable; favourites, cities and history are not.",
      {
        skinType: PROFILE.skinType,
        exposedSkinFraction: PROFILE.exposedSkinFraction,
        age: z.number().min(0).max(120).nullable().optional()
          .describe("Age in years, or null for the adult baseline"),
        targetIU: PROFILE.targetIU,
      },
      personal(
        "update_my_profile",
        "profile:write",
        (userId, args: { skinType?: number; exposedSkinFraction?: number; age?: number | null; targetIU?: number }) =>
          updateMyProfileTool(store(), userId, args),
      ),
    );

    registerAppTool(
      server,
      "get_my_history",
      {
        description: "The signed-in user's sun history from the app's calendar: which recent days had viable sun, which they confirmed going outside, and their current streak. Covers the calendar days from `from` to `to`; records exist only for days the app was open, so a date missing from `records` means nothing was measured, not that the sun was insufficient. Requires OAuth (scope history:read). Renders as a calendar the user can tap to confirm a day.",
        inputSchema: { days: z.number().int().min(1).max(365).optional().describe("How many recent days to return; default 30") },
        _meta: { ui: { resourceUri: HISTORY_RESOURCE_URI } },
      },
      personal(
        "get_my_history",
        "history:read",
        (userId, args: { days?: number }) => myHistoryTool(store(), userId, args),
        historyChartMeta,
      ),
    );

    server.tool(
      "log_sun_session",
      "Sets a day's answer in the signed-in user's history calendar. Three values: confirmed=true (went out, the default), confirmed=false (had usable sun but stayed in), confirmed=null (clear the answer). Defaults to today. Requires OAuth (scope history:write).",
      {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Day to set, YYYY-MM-DD; defaults to today"),
        minutes: z.number().min(1).max(600).optional().describe("Minutes the user reports having spent in the sun (acknowledged, not stored)"),
        confirmed: z.boolean().nullable().optional()
          .describe("true (default) the user went out; false they had sun but stayed in; null clears the answer"),
      },
      personal("log_sun_session", "history:write",
        (userId, args: { date?: string; minutes?: number; confirmed?: boolean | null }) => logSunSessionTool(store(), userId, args)),
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
