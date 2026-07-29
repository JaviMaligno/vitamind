# MCP Apps + migration to the 2026-07-28 spec

Written 2026-07-29 from a session in the `personal-website` repo. Everything in
"Current state" below was verified against this repo, not assumed. The widget
audit (part A) is done — this document is the audit, not a request to run one.

**Verification pass, 2026-07-29 (same day, in this repo).** The open questions in
"Cross-cutting problems" were closed by running code, not by reading docs, and two
of the original recommendations turned out to be wrong. Those paragraphs have been
rewritten in place and carry a `Verified` / `Corrected` marker. The rankings and
the suggested slice order were not touched — they still hold. Summary of what
changed: `registerAppTool` on the current stack **works** (Part A confirmed
independent of Part B); the chart-data channel is the result's `_meta`, **not**
`structuredContent`; i18n and light/dark are answered by the host context, so
there is nothing to decide; bundling needs neither Vite nor runtime file reads;
and there is a peer-dependency conflict that will break CI if not handled.

Two independent workstreams, deliberately kept apart:

- **Part A — MCP Apps.** Interactive widgets rendered inline in the chat. Works
  **today**, on the v1 SDK, no protocol migration needed. This is the one with
  user-visible and marketing value.
- **Part B — 2026-07-28 spec migration.** Plumbing. Invisible to users. Blocked
  on getting off `mcp-handler`.

Do A first. B does not gate A.

## Current state (verified)

| Thing | Value |
|---|---|
| MCP server | `lib/mcp-server.ts`, served at `app/api/mcp/[transport]/route.ts` (public) and `app/api/mcp-auth/[transport]/route.ts` (OAuth) |
| Handler | `mcp-handler` **1.1.0** (Vercel), pinned to `@modelcontextprotocol/sdk` ≥1.26.0 (v1) |
| Statefulness | Already stateless in practice — "no Redis, so the SSE transport is not offered" |
| Tools | 6 public (`search_city`, `get_sun_times`, `get_vitamin_d_window`, `get_vitamin_d_year`, `get_current_status`, `estimate_sun_session`) + 4 OAuth (`get_my_profile`, `get_my_cities`, `get_my_history`, `log_sun_session`) |
| Tool logic | Pure functions in `lib/mcp-tools.ts` / `lib/mcp-personal.ts`, unit-tested |
| Auth | Own OAuth 2.1 AS in `lib/oauth.ts`, tables in `supabase/migrations/20260719_mcp_oauth.sql`, opaque `vd_at_…` tokens |
| Registry manifest | `server.json` (schema `2025-12-11`) |
| User docs | `app/[locale]/connect/page.tsx` + `components/AiConnections.tsx` |
| Branch model | `master` = prod, `dev` = preview. CI gate: lint + typecheck + test + build |

MCP Apps is supported today by Claude web and Claude Desktop (plus ChatGPT,
Cursor, VS Code Copilot, Goose, Postman, MCPJam). Extension identifier:
`io.modelcontextprotocol/ui`.

---

# Part A — MCP Apps

## How it works, in one paragraph

A tool declares `_meta.ui.resourceUri` pointing at a `ui://…` resource. The host
fetches that resource (it can preload it before the tool even runs), gets an HTML
document, and renders it in a sandboxed iframe inside the conversation. The tool
result is pushed into the iframe (`app.ontoolresult`). The iframe can call back
into the server (`app.callServerTool`) over a `postMessage` JSON-RPC bridge with
`ui/*` methods. Server helpers: `registerAppTool` / `registerAppResource` from
`@modelcontextprotocol/ext-apps/server`. Client side: the `App` class from
`@modelcontextprotocol/ext-apps`.

Crucially, **the tool must still return meaningful text content** for clients
without UI support. The widget is additive; it never replaces the text answer.

## The audit: what is worth building

Ranked by (value in a chat context) ÷ (effort). "Value in a chat context" is not
the same as value in the app — a widget only earns its place if the text answer
is genuinely worse than a picture. Three things were rejected on exactly that
test; they are listed at the end.

### 1. Today's window — `get_current_status` (+ `get_vitamin_d_window`)

**Why.** This is the app's core question and the answer that reads worst as
text: a state enum, a UV number, minutes needed, a window start/end, a countdown.
A poster verdict plus the daily curve with the viable band shaded answers it at a
glance. It is also the highest-traffic tool, so it is where a widget gets seen.

**Reuse.** `components/dashboard/DayHeroBold.tsx` for the visual language (phase
gradient, giant status headline, coloured dot per status) and
`components/DailyCurve.tsx` for the curve (860×200 SVG, threshold line, cloud
shading). `components/dashboard/day-status.ts` already maps status → key.

**Data gap.** `currentStatusTool` returns scalars only. `DailyCurve` needs the
full `SolarPoint[]` curve plus `thresholdElevation`, and the hero wants the phase.
See "The data-shape problem" below.

### 2. The year of a place — `get_vitamin_d_year`

**Why.** Today this returns 12 month objects plus summary fields, and the model
has to narrate it. `monthsWithSun` vs `solidMonths` vs `partialMonth` vs
`exactViableSpan` is exactly the kind of nuance that gets flattened into a wrong
sentence. The year strip shows the season edges honestly and instantly.

**Reuse.** `components/CityYearStrip.tsx` — **the most portable component in the
repo**: server-rendered (no `"use client"`), no context, no i18n hook, plain
props (`hoursByDay`, `monthLabels`, `caption`, `legend`), pure SVG. Pair it with
a compact month table derived from `byMonth`.

**Data gap.** The tool returns `byMonth` (12) but not `hoursByDay` (365), which
is what the strip renders. `cityYearProfile()` already computes it inside
`vitaminDYearTool` — it just is not returned.

### 3. City comparison — N × `get_vitamin_d_year`

**Why.** The one case where the chat beats the app outright. The app compares
cities poorly (you navigate between pages); a conversation naturally asks "Madrid
vs Berlin vs Oslo — where do I actually get winter sun?". The model calls the
year tool once per city and the widget stacks the strips on a shared axis. This
is **new capability, not a port of an existing screen** — which is also what
makes it the best demo.

**Reuse.** Same `CityYearStrip`, repeated, plus a small header row per city.

**Effort.** Medium. Needs a widget that accumulates results across several tool
calls rather than rendering one payload.

### 4. Personal history — `get_my_history` (OAuth)

**Why.** Two reasons beyond the visual: it is the strongest argument for
connecting the account (the whole point of the OAuth tier), and it is the natural
place to demonstrate **bidirectional** widgets — tapping a day calls
`log_sun_session` and the calendar updates in place, without a chat round-trip.
That is the capability that separates MCP Apps from a screenshot.

**Reuse.** `components/dashboard/HistoryCalendar.tsx` — but it is the largest
component in play (390 lines, week/month modes, swipe, navigation callbacks).
Port a reduced read-plus-toggle version, not the whole thing.

**Watch out.** Only works when the user connected via `/api/mcp-auth/mcp`. The
widget needs a sane empty/unauthenticated state, mirroring the tool's existing
`authentication_required` payload.

### 5. Profile / exposure picker — feeds every other tool

**Why.** The spec calls this out explicitly as a good fit ("configuring with many
options"). Skin type, exposed-skin fraction, age and target IU currently arrive
through conversational back-and-forth or not at all, and every calculation
silently falls back to defaults (type 3, 0.25, adult, 1000 IU). A small form that
recomputes minutes live removes several turns of dialogue and makes the defaults
visible instead of invisible.

**Reuse.** `components/dashboard/ExposureQuickPicker.tsx` (4 presets with emoji:
🧤 0.10, 💪 0.18, 👕 0.25, 🩱 0.40) and `components/SkinSelector.tsx`.

**Design decision to make.** Does the widget push the chosen profile back into
the model's context (so later tool calls inherit it), or write it to the user's
saved profile (OAuth, needs a new write tool)? Context-only is the smaller, safer
first version. The `App` class supports updating model context.

### 6. World map / latitude×year heatmap — maybe, later

`components/WorldMap.tsx` (311 lines, d3 + topojson) and
`components/GlobalHeatmap.tsx` (canvas, 130×183 grid computed client-side) are
the most impressive things in the app and the worst fit for a first widget: heavy
dependencies inside an iframe, external geo data that needs `_meta.ui.csp`
entries, and a use case ("browse the whole planet") that nobody arrives at from a
chat question. Revisit once the pipeline is proven.

### Rejected, and why

- **`estimate_sun_session`** — the answer is two numbers (IU made, minutes to
  burn). A widget adds nothing. Fold the inputs into #5 if anywhere.
- **`search_city`** — a list of 5 cities with coordinates. Text is better.
- **`get_sun_times`** — `SunTimesPanel`'s bézier sun arc is pretty, but sunrise
  and sunset are two timestamps; the picture carries no information the sentence
  lacks. Only worth it if it rides along inside #1.

## Cross-cutting problems to solve before writing widget code

These apply to every widget above and are the real work.

### The data-shape problem

Every candidate needs a richer payload than the tools return today. The tools
were tuned to be *readable by a model* — compact, rounded, prose-annotated. Charts
need arrays.

Do **not** fatten the text content: that would make every non-UI client's context
worse to serve a client that renders a picture.

**Corrected 2026-07-29.** The original text offered `structuredContent` and `_meta`
as one option, preferring `structuredContent`. They are not interchangeable and the
preference was backwards:

1. **Put chart data in the result's `_meta`.** The host delivers the tool result to
   the iframe as `ui/notifications/tool-result` whose `params` is the **whole
   `CallToolResult`** (`McpUiToolResultNotification.params: CallToolResult`), so
   `_meta` reaches the widget intact. `_meta` is protocol metadata and does not
   enter the model's context — which is exactly the property this section is asking
   for. Verified: a 365-number array round-tripped through `mcp-handler` untouched.
2. **`structuredContent` is the wrong channel here.** Clients generally *do* surface
   it to the model, so using it for chart arrays causes the very context bloat this
   section exists to avoid. It stays useful for small structured answers a model
   should read — not for 365 numbers.
3. **A second tool call via `app.callServerTool` on mount** remains the fallback for
   payloads too big to ride along at all. Costs a round-trip; not needed for #2.

Concretely missing: the `SolarPoint[]` curve and `thresholdElevation` (#1);
`hoursByDay` 365-array (#2, #3); nothing for #4 (`records[]` already has what the
calendar needs). For #2 this is a one-line change — `cityYearProfile()` already
returns `hoursByDay` at `lib/mcp-tools.ts:241`, it is simply dropped.

### Components do not port for free

Every candidate component is React under Next with `next-intl` (`useTranslations`),
Tailwind v4, and app context. A widget is a standalone HTML bundle in an iframe —
none of that comes along. For each one, either extract a presentational component
with plain props (no hooks, no context, strings passed in) and have both the app
and the widget render it, or accept a fork and keep them in sync by hand. The
first is more work now and much less later; the fork is defensible only for #4.

`CityYearStrip` is already in the portable shape. Use it as the template for what
"portable" means here. One caveat found on 2026-07-29: at 62 lines it is otherwise
plain props and inline styles, but the caption carries a single Tailwind class
(`text-on-window-faint`) that will not exist inside the iframe. Replace it with an
inline style driven by the host's `ctx.styles`, which is the right source for that
colour anyway.

### Bundling inside Next.js

**Verified 2026-07-29 — cheaper than feared.** The reference setup is Vite +
`vite-plugin-singlefile` producing one self-contained HTML file, read with `fs` in
the resource handler. Neither half of that is necessary here:

- **No new bundler.** `esbuild@0.27.3` is already in `node_modules` (transitively,
  via vitest) and bundles + inlines a single HTML file fine. Add it as an explicit
  devDependency anyway — depending on a transitive package is how builds break
  silently later — but the install cost is zero.
- **No runtime file reads.** Emit the bundle as a generated `.ts` module that
  exports the HTML as a string, and `import` it from the resource handler. The
  reference is then a static import, so Vercel's output tracing has nothing to get
  wrong. This mirrors the existing `scripts/build-sw.mjs` + `prebuild` hook pattern
  — same shape, same place in the build.

The residual risk this section was guarding against (a serverless function unable
to read its own asset) disappears with the static import. What still deserves a
preview deploy before widget #2 is the rendering itself, not the plumbing.

### Things that will bite

- **~~i18n~~ — answered by the host, 2026-07-29.** There is nothing to decide on
  the server. The host hands the iframe `ctx.locale` and notifies changes through
  `onhostcontextchanged`. Bundle all six locales into the widget (for #2 that is
  four strings) and pick at runtime from `ctx.locale`, mapping the base subtag and
  falling back to the app default. Do **not** push a locale through the tool
  payload: the server has no idea what language the conversation is in.
- **~~Light/dark~~ — same answer.** `ctx.theme` is `"light" | "dark"`, and
  `ctx.styles` carries CSS variables from the host. The widget consumes both and
  re-renders on `onhostcontextchanged`; it never picks a theme itself.
- **CSP.** Iframe CSP is declared in `_meta.ui.csp`, which is separate from the
  app's own CSP in `next.config.ts`. Bundling everything inline avoids most of
  this — another argument for singlefile.
- **`registerAppTool` on the current stack — verified working, 2026-07-29.**
  Exercised end-to-end through `createMcpHandler` with real `Request`/`Response`
  objects (the handler is web-standard, so this needs no Next server): the
  `_meta.ui.resourceUri` survives to `tools/list` (with the deprecated
  `ui/resourceUri` mirrored alongside), `resources/read` serves the HTML with
  `mimeType: text/html;profile=mcp-app`, the existing ten tools are untouched, and
  `initialize` starts advertising a `resources` capability the server did not have
  before. **Part A does not depend on Part B.**
- **Peer-dependency conflict — new, will break CI if ignored.**
  `@modelcontextprotocol/ext-apps@1.7.5` declares peer
  `@modelcontextprotocol/sdk: ^1.29.0`; `mcp-handler@1.1.0` (the latest — there is
  nothing newer) pins it to **exactly** `1.26.0`. `npm ci` fails with `ERESOLVE`
  unless `package.json` gets an `overrides` entry. It is safe at runtime for a
  concrete reason, not by luck: `registerAppTool` takes
  `Pick<McpServer, "registerTool">` and `registerAppResource` takes
  `Pick<McpServer, "registerResource">` — the package is a `_meta`-normalising
  wrapper and touches no API added after 1.26.0. Verified against the repo's own
  installed 1.26.0. Write the `overrides` **and the reason for it** into the first
  PR; leaving CI to discover it is how this lands as a mystery red build.

## Suggested first slice

Ship **#2 (year strip)** first, not #1. It has the smallest data gap (one array
already computed), the only component that is already portable, no auth, and it
proves the whole bundling pipeline end-to-end on the easiest possible case. Then
#1 (highest traffic), then #3 (best demo), then #4/#5.

Definition of done for the first one: the strip renders in Claude Desktop against
a preview deploy, the same tool still returns its current text payload unchanged
for a non-UI client, and CI stays green.

Do not forget to update `/connect` and `components/AiConnections.tsx` once a
widget is live — that page is the user-facing story, and "it draws you a chart in
the chat" is the headline, not a footnote.

---

# Part B — migration to the 2026-07-28 spec

## What actually changes

The core became **stateless**: no protocol sessions, no `Mcp-Session-Id`, no
`initialize`/`initialized` handshake. Each request carries its protocol version
and client capabilities in `_meta`. Servers **must** implement `server/discover`.
Also removed: `ping`, `logging/setLevel`, SSE resumability (`Last-Event-ID`), the
GET subscription endpoint (now `subscriptions/listen`). Sampling, Roots and
Logging are deprecated with a ≥12-month window. DCR is deprecated in favour of
Client ID Metadata Documents. Server-initiated requests are replaced by **MRTR**:
the server returns `InputRequiredResult` with `inputRequests` and an opaque
`requestState`; the client retries the original request carrying `inputResponses`.

**Nothing here is urgent.** Backwards compatibility is designed in: clients must
treat results without `resultType` as `"complete"`, and `server/discover` doubles
as a probe that falls back to the legacy `initialize`. This server keeps working.

## What it costs here

The blocker: **`mcp-handler` is still on the v1 SDK** and its releases mention
nothing about 2026-07-28, stateless, or `server/discover`. Migrating means
leaving it.

The replacement exists and fits: SDK v2's `@modelcontextprotocol/server` exports
its own `createMcpHandler` returning a web-standard `fetch(Request) => Response`,
which drops straight into an App Router route handler. The factory runs once per
HTTP request — genuinely stateless, which matches how this server already
behaves.

Work items, in rough order of pain:

1. **Auth is the real cost.** v2's handler verifies nothing; you verify the token
   *before* it and pass `handler.fetch(request, { authInfo })`. So `withMcpAuth`
   and `verifyToken`'s current wiring get rebuilt against `lib/oauth.ts`. The
   two-endpoint design (public never-401s, `mcp-auth` always-401s-to-trigger-OAuth)
   must survive intact — that behaviour is load-bearing and documented at
   `/connect`.
2. **Package split.** `@modelcontextprotocol/sdk` → `core` / `client` / `server`.
   Run `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` for the mechanical
   part. Needs Node 20+ and Zod 4.2+.
3. **Tool registration.** `server.tool(name, desc, shape, handler)` becomes
   `server.registerTool(name, { description, inputSchema: z.object({…}) }, handler)`.
   All 10 tools, plus the `personal()` wrapper whose `extra.authInfo` becomes the
   structured `ctx`.
4. **`server/discover`** must be implemented and should advertise
   `extensions` — including `io.modelcontextprotocol/ui` once Part A lands.
5. **Cacheable lists.** `ttlMs` + `cacheScope` are now required on `tools/list`,
   `resources/list`, `prompts/list`, `resources/read`. Tool lists here are static,
   so a long TTL with `cacheScope: "public"` is free performance.
6. **`server.json`** points at schema `2025-12-11`; refresh it and re-check the
   directory submissions tracked in
   `docs/plans/2026-07-27-mcp-directory-submissions.md`.
7. **DCR.** `lib/oauth.ts` implements dynamic client registration, now deprecated
   in favour of CIMD. It keeps working for at least twelve months — note it, do
   not rush it.

Worth knowing while you are in there: **MRTR** would let a tool ask for a missing
profile value mid-call instead of silently defaulting to skin type 3 — which
overlaps with widget #5. Two routes to the same problem; pick one deliberately
rather than building both.

## References

- [Key Changes — 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [Spec announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Bringing MCP 2026-07-28 to Claude](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview) · [build guide](https://modelcontextprotocol.io/extensions/apps/build) · [ext-apps repo + examples](https://github.com/modelcontextprotocol/ext-apps)
- [Extensions overview / negotiation](https://modelcontextprotocol.io/docs/extensions/overview) · [client matrix](https://modelcontextprotocol.io/extensions/client-matrix)
- [SDK v1→v2 migration guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md) · [serving over HTTP (v2)](https://ts.sdk.modelcontextprotocol.io/v2/serving/http)
- There is a `create-mcp-app` skill: `/plugin marketplace add modelcontextprotocol/ext-apps` then `/plugin install mcp-apps@modelcontextprotocol-ext-apps`. Worth installing in the new session before starting Part A.
