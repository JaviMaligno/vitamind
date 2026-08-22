# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VitaminD Explorer is a solar vitamin D synthesis calculator PWA. It helps users determine when and where they can synthesize vitamin D based on solar elevation angles, UV index, skin type, body exposure, and age. Built with Next.js App Router + next-intl (6 locales), deployed on Vercel. Public URL: https://getvitamind.app

## Development Commands

The Next.js app lives at the **repo root** (there is no `vitamind/` subdirectory).

```bash
npm run dev         # Dev server at localhost:3000 (regenerates public/sw.js first)
npm run build       # Production build (regenerates public/sw.js first)
npm start           # Start production server
npm run lint        # ESLint (flat config)
npm run typecheck   # tsc --noEmit
npm test            # Vitest (unit/component tests)
npm run test:watch  # Vitest watch mode
npm run e2e         # Standalone Playwright install-awareness script (needs BASE_URL)
```

**Quality gate:** `.github/workflows/ci.yml` runs lint + typecheck + test + build on every push/PR. All four must pass before deploying. See `docs/PRODUCTION_READINESS.md` for the practices that keep this project production-ready — read it before touching deploys, env vars, Supabase policies, or the push pipeline.

## Architecture

### Next.js App Router (`app/`)

Routes are locale-segmented via next-intl (`es` default without prefix; `en`, `fr`, `de`, `ru`, `lt` prefixed). `proxy.ts` at the repo root is the middleware entry point (Next 16 convention) handling locale detection/redirects; it excludes `/api`.

- **`app/layout.tsx`** — Passthrough root layout (just returns `children`). The real `<html>`/`<body>`, metadata, and PWA manifest link live in `app/[locale]/layout.tsx` (required by the next-intl as-needed i18n, where the default locale has no URL prefix). Service worker registration is **not** here — it's done client-side in `components/UpdateNotice.tsx`.
- **`app/[locale]/page.tsx`** — Home. Other screens: `dashboard/`, `explore/`, `learn/`, `profile/`, `partners/`, `offline/`, `reset-password/`.
- **`app/[locale]/[cityPrefix]/[city]/page.tsx`** — SEO city pages with localized route prefixes AND slugs (`/vitamina-d/madrid` ↔ `/en/vitamin-d/madrid`). `lib/city-routes.ts` + `i18n/metadata.ts` build the hreflang alternates. **Static (`revalidate = false`)** — a pure function of (city, `DOY_REFERENCE_YEAR`).
- **`app/[locale]/_sun-hub/` + six static prefix folders** (`amanecer/`, `sunrise/`, `lever-du-soleil/`, `sonnenaufgang/`, `voskhod/`, `sauletekis/`) — the 240 today hubs (`/amanecer/madrid`). They used to share the `[cityPrefix]/[city]` file with the city pages, which forced ONE `revalidate` on all 678 pages because segment config is per file. A static segment outranks a dynamic sibling, so the hubs now have folders of their own and keep `revalidate = 86400` while the city pages went static. All six folders are thin re-exports of `_sun-hub/hub-route.tsx`. **`app/__tests__/sun-hub-split.test.ts` is load-bearing:** six directory NAMES duplicate six `SUN_PREFIX` values with nothing in the type system connecting them, so it pins the folder set to `SUN_PREFIX`, pins each folder's `PREFIX` literal to its own directory name, and reassembles the 240 hubs **from disk**. Rename or delete a folder and 40 URLs per locale stay in the sitemap and 404.
- **`app/[locale]/[cityPrefix]/[city]/[month]/page.tsx`** — Programmatic sunrise/sunset SEO pages (`/amanecer/madrid/julio` ↔ `/en/sunrise/madrid/july`), 40 starter cities × 12 months × 6 locales = 2,880 pages, **static (`revalidate = false`)** with the day-by-day sun table in the HTML. Routing/slugs in `lib/sun-routes.ts` (shares the `[cityPrefix]` segment with city pages; each validates its own prefix). Grow `SUNRISE_CITIES` there for the next waves.
- **`app/[locale]/connect/page.tsx`** — "Connect your AI" documentation page (`/connect`, in the top nav): the two MCP connector URLs, per-client setup steps and a mocked consent preview rendered from the real `oauth` strings.
- **`app/[locale]/error.tsx`, `app/[locale]/not-found.tsx`, `app/global-error.tsx`** — error boundaries; localized copy under the `errorPage`/`notFoundPage` message keys.
- **`app/api/weather/route.ts`** — Proxies Open-Meteo (UV index, cloud cover). Validates lat/lon/dates, 8s upstream timeout, opaque error responses.
- **`app/api/cities/route.ts`** — Server-side city search against Supabase (localized RPCs with fallbacks).
- **`app/api/push/subscribe/route.ts`** — Push subscription CRUD (validates/clamps all input).
- **`app/api/push/notify/route.ts`** — Cron-triggered (daily 8 AM UTC via Vercel cron) push broadcaster. Auth: `Authorization: Bearer $CRON_SECRET`. Logs a run summary; returns 500 if every delivery fails so Vercel marks the cron run failed.
- **`app/api/mcp/[transport]/route.ts` + `app/api/mcp-auth/[transport]/route.ts`** — Remote MCP server (`mcp-handler`, stateless Streamable HTTP; no Redis, so no SSE transport), tool set registered once in `lib/mcp-server.ts` and served at TWO endpoints: `/api/mcp/mcp` (public, auth optional — never 401s) and `/api/mcp-auth/mcp` (auth REQUIRED — its 401 is what triggers the client's OAuth flow). Six public tools (`search_city`, `get_sun_times`, `get_vitamin_d_window` with `atTime`, `get_vitamin_d_year`, `get_current_status`, `estimate_sun_session`) plus four OAuth-scoped personal tools (`get_my_profile`, `get_my_cities`, `get_my_history`, `log_sun_session`). Tool logic is pure and unit-tested in `lib/mcp-tools.ts` / `lib/mcp-personal.ts`; per-call usage logging (tool + duration only, never args). User docs at `/connect`.
- **`app/api/oauth/*` + `app/.well-known/oauth-*`** — Minimal OAuth 2.1 authorization server for the MCP personal tools (`lib/oauth.ts`): dynamic client registration, PKCE S256 mandatory, single-use hashed codes, hashed opaque tokens (`vd_at_…`) with refresh rotation. Identity = Supabase Auth via the consent page at `/oauth-consent` (namespace `oauth` in messages). Supabase JWTs are never accepted at the MCP endpoint. Tables in `supabase/migrations/20260719_mcp_oauth.sql` (service-role only, RLS with no policies).

State lives in `context/` providers (`AppProvider`, `ThemeProvider`, `InstallProvider`) and `hooks/` — there is no single-page monolith.

### Core Libraries (`lib/`)

- **`solar.ts`** — Solar geometry: declination, elevation, sunrise/sunset, day curves. Pure math.
- **`uv-model.ts`** — UV index model (ozone, Madronich); validated against literature anchors in tests.
- **`vitd.ts`** — Vitamin D synthesis: MED by Fitzpatrick skin type, age factor, minutes needed.
- **`cities.ts`** / **`cities-api.ts`** / **`geonames.ts`** — Built-in city DB, Supabase-backed search client, local cities15000.json fuzzy search.
- **`city-routes.ts`**, **`city-slugs.ts`**, **`city-content.ts`**, **`city-copy.ts`** — City page routing/SEO/content.
- **`storage.ts`** — localStorage persistence (all reads/writes guarded with try/catch).
- **`profile.ts`** — Supabase profile sync for authenticated users.
- **`push-store.ts`** — Supabase push subscription store (service role key; raises on errors — never swallow them, see incident history below). Rows are scoped per Vercel project by `vapid_public_key`.
- **`supabase.ts`** — anon-key client (browser). Never import the service key client-side.

### i18n (`i18n/`, `messages/`)

next-intl with `messages/{es,en,fr,de,ru,lt}.json`. `i18n/routing.ts` defines locales, `i18n/metadata.ts` builds alternates/canonicals, `i18n/legacy-locale-redirect.ts` handles pre-i18n URLs. `messages/__tests__/health-claims.test.ts` guards medical copy across locales — keep it passing when editing translated health content.

### Tests

Vitest (`vitest.config.ts`, jsdom): test files under `lib/__tests__`, `app/api/__tests__`, `components/__tests__`, `i18n/__tests__`, `messages/__tests__`, `app/__tests__`. API route tests mock `lib/push-store` and `global.fetch`. `tests/e2e/` holds standalone Playwright scripts (not `@playwright/test` specs), excluded from the Vitest run — execute them directly with `node` (e.g. `node tests/e2e/sw-update.spec.mjs`, which drives the real service worker in Chromium).

### PWA

- Service worker: `public/sw.js` is **generated at build time** by `scripts/build-sw.mjs` from `scripts/sw.template.js` (runs via the `predev`/`prebuild` npm hooks; `public/sw.js` is gitignored). The template's `__BUILD_VERSION__` placeholder is replaced with the git SHA (or `VERCEL_GIT_COMMIT_SHA` on Vercel), so `CACHE_NAME` changes on every deploy and invalidates the previous cache.
- Fetch strategy: static assets (`_next/static`, icons, `.json`) cache-first; `/api/*` network-only (always fresh); pages network-first with cache fallback, then the `/offline` page.
- Update flow: the new SW does **not** `skipWaiting` automatically — it stays in `waiting`. `components/UpdateNotice.tsx` registers the SW, detects a waiting worker (only when a controller already exists, so the notice never shows on a first install), and runs a **build-version handshake** before deciding what to do: the page's `NEXT_PUBLIC_BUILD_VERSION` (inlined by `next.config.ts` from the git SHA, same value `scripts/build-sw.mjs` stamps into the SW) is compared against the waiting worker's version (SW replies to a `GET_VERSION` message). If they match — the usual case after an online reload, because pages are network-first and the document is already the new build — the worker is activated silently (`SKIP_WAITING` posted, the resulting `controllerchange` deliberately does **not** reload). Only on a mismatch (warm PWA resume, long-lived tab, offline cache fallback — i.e. the page really is stale) does the "new version / Reload" banner appear; tapping Reload posts `{type:'SKIP_WAITING'}`, the SW calls `self.skipWaiting()`, and the resulting `controllerchange` triggers `window.location.reload()` onto the new version. No answer to `GET_VERSION` or a missing page version falls back to showing the banner. Covered by `components/__tests__/UpdateNotice.test.tsx` (unit) and `tests/e2e/sw-update.spec.mjs` (real-SW Playwright).
- Update detection on resume: an in-scope navigation / cold start already runs `register()` → update check, but a **warm** resume (the OS keeps the installed PWA in memory and the user re-opens it without a reload) triggers no navigation and thus no check. To cover that, `UpdateNotice.tsx` calls `registration.update()` on `visibilitychange` when the document becomes `visible` — event-driven (no background polling), one lightweight conditional request at the moment the user re-opens the app. There is no autonomous "every 24h" background check; the 24h rule only cache-busts the SW script once some event triggers a check.
- Manifest at `public/manifest.json` for standalone mobile install.
- Icons generated via `scripts/generate-icons.mjs` (SVG → PNG via Sharp).

## Copy that states a number must be checked against the code that computes it

**Any factual claim in `messages/*.json` is a claim about `lib/`.** Before shipping copy that
names a threshold, an angle, a duration or a criterion, open the module that computes it and
confirm. Never copy a figure from elsewhere on the site — that is how the wrong ones spread.

This is not a hypothetical. Five stale claims shipped to production and lived there for
weeks or months, all found in August 2026, none by the person who wrote them:

| Claim | Where | Reality |
|---|---|---|
| "Umbral 45° (in vitro) / 50°" | site footer, every page, 6 locales | `MIN_UVI = 3`; the elevation reaching it varies ~29–42° with ozone |
| "un ángulo solar superior a 30–35°" | `learn.block1.q4.a` | same |
| synthesis impossible *because* peak elevation | `sunrisePage.proseNone` | it is impossible because UVI never reaches 3; Rome at 38.5° has a window, Oslo at 39.5° does not |
| "cuando el índice UV supera 3" | `sunrisePage.proseSynthesis` | `uvi >= MIN_UVI` includes exactly 3 |
| `20:60`, `13 h 60 min` | every sunrise page | minute rounded without carrying into the hour |

The footer's version was then copied into `/methodology`, so writing a new page propagated
the error rather than catching it.

**What actually works:** when dispatching a review, instruct it explicitly to *read the copy
against the module that computes the figure* — naming the files. That instruction found a
blocker in every one of the three AI-Overview phases. A general "review this" did not.

## The client only gets the namespaces it can read

`app/[locale]/layout.tsx` passes `pickClientMessages(messages)`, not `messages`, to
`NextIntlClientProvider` — the list is `CLIENT_NAMESPACES` in `i18n/client-messages.ts`. Seven
namespaces (`learn`, `sunrisePage`, `connect`, `methodology`, `about`, `compass`, `notFoundPage`)
only ever render on the server and are ~45 KB of every response.

**Why this needs care rather than a quick edit: next-intl does not throw on a missing message.**
Its default `onError` is `console.error` and its default `getMessageFallback` joins namespace and
key, so a namespace you forget to add renders the literal string `sunrisePage.eyebrow` into HTML
Google indexes, **with a 200 status**. It is not a crash; it is silently degraded copy on
thousands of SEO pages.

So if you make a server-only component client-side, or add a `useTranslations` anywhere:
`i18n/__tests__/client-messages.test.ts` is the net. It walks the real client module graph and
scans twice — once reading namespaces out of hook calls, and once over **every string literal in
every client-graph module**, because a key can reach the browser without sitting next to a hook
call (handed to a helper, held in a table, passed as a prop). Server components are unaffected:
`getTranslations` resolves against `i18n/request.ts`, which still loads the full file.

## Copy changes to the month and city pages need a revision bump

`app/sitemap.ts` no longer stamps `new Date()` on all 3,612 URLs. The 2,880 month pages and 438
city pages publish a **declared** date from `lib/content-revision.ts`; only the 240 hubs and 54 app
pages still move with the build.

That means a copy fix could ship to 2,880 pages announced as unchanged, so the engines keep
serving the old text — the failure mode the table above documents five times over. The guard is
`lib/content-fingerprint.ts` + `lib/__tests__/content-revision.test.ts`:

```bash
npx vitest run lib/__tests__/content-revision.test.ts   # prints the block to paste
```

Change copy in the `sunrisePage` or `cityPage` namespaces, or any module that determines what
those pages print, and that test fails with the new block. **Read the diff it prints before
pasting it** — it is telling you how far the change reached. Then update `date` too, if the content
really did change: the date answers "when did the CONTENT change", so re-recording a hash because
you fixed the *instrument* is not a content change and must not move it.

`figures` hashes the **source** of the computing modules, not their output. Hashing the computed
numbers was tried and failed CI: floating point is not identical across machines, and rounding
does not fix it — it relocates the problem to a knife edge where one day length formats to a
different minute on Linux than on macOS.

## Key Technical Details

- **Path alias:** `@/*` maps to repo root (`tsconfig.json`)
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **`web-push`** is in `serverExternalPackages` (`next.config.ts`) to avoid client bundling
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.) are set in `next.config.ts` for every deploy. If a new external origin is needed (script/style/fetch), add it to the CSP there — do not remove the header.
- **Vercel cron:** `vercel.json` — `0 8 * * *` hits `/api/push/notify`, `10 0 * * *` hits `/api/revalidate-today` (which self-verifies; see "Cron jobs")
- Interactive components use `"use client"`; city pages and layouts are server components for SEO.

## Environments

Both environments live in the single Vercel project `vitamind` (scope `js-projects-98e2a0d2`, the personal account), separated by Vercel environment:

| Env | Git branch | Vercel environment | Public URL | Purpose |
|---|---|---|---|---|
| **Production** | `master` | Production | https://getvitamind.app (alias: `vitamind-six.vercel.app`) | Stable, what users and partners see |
| **Dev / staging** | `dev` | Preview | https://getvitamind-dev.vercel.app | Personal testing (e.g. push notifications). Not for partners. |

The Preview environment has its **own** VAPID keys, `CRON_SECRET` and `PUSH_TEST_ALLOWED_ENDPOINT` (copied from the retired `vitamind-dev` project), so push subscriptions stay isolated between prod and dev — see "Push subscription isolation" below. The old standalone `vitamind-dev` project was deleted on 2026-07-17.

## Vercel plan and usage limits — a deploy is not free

The project is on the **Hobby (free)** plan, and as of 2026-08-22 it is **over** two of its
limits. Measured from the Usage dashboard (30-day window ending 2026-08-22):

| Resource | Used | Hobby limit |
|---|---|---|
| **ISR Writes** | 362,730 | 200,000 — **181%** |
| **Fast Origin Transfer** | 10.58 GB | 10 GB — **106%** |
| **ISR Reads** | 950,392 | 1,000,000 — 95% |
| Fast Data Transfer | 6.5 GB | 100 GB |
| Edge Requests | 383 K | 1 M |
| Function Invocations | 230 K | 1 M |
| Fluid Active CPU | 2 h 16 m | 4 h |

### What is established

- **The write bill began with the ISR cache class, on a known date.** Commit `71993ce`
  (2026-08-10 17:43) added the first `export const revalidate` in the repo's history. Writes went
  from ~0 to 22 K that same day. For the weeks before it, the same ~3,600 pages were prerendered
  on **every** deploy for **~0 write units**. So a *static* prerender is free; putting routes in
  the ISR class is what started the meter.
- **Fast Origin Transfer is not a separate problem.** (950,392 + 362,730) × 8 KB = 10.7 GB ≈ the
  10.58 GB reported. It is the ISR traffic measured in bytes; nothing else contributes materially.
- **Reads bill statically prerendered routes too.** Between 2026-07-30 and 2026-08-09 the read
  meter was already flat at 30–40 K/day while **zero** routes were in the ISR class. So
  reads ≈ crawled URLs × served HTML bytes, with no dependence on cache class. That is why
  lengthening `revalidate` does nothing for reads, and why **URL count is the read budget**.
- **Three page counts are floating around; they are different things.** 3,612 = sitemap entries.
  3,634 = prerendered routes in `.next/prerender-manifest.json`. Of those, the ISR-class ones
  (`initialRevalidateSeconds: 86400`) were 3,558 before 2026-08-22 and are **240** after. Say
  which one you mean.
- **A sweep of the ISR set cost ~35,500 write units** when it was 3,558 routes. After the
  2026-08-22 work it is 240 hubs at ~1,200–1,400 units. Measured by gzipping every `.html` +
  `.rsc` under `.next/server/app` and dividing by the 8 KB unit — re-measure the same way rather
  than scaling the old number, because the per-page bytes changed too.

### What changed on 2026-08-22, and what it bought

Four changes, all measured in production afterwards:

| | Before | After |
|---|---|---|
| ISR-class routes | 3,558 | **240** (the six hub folders × 40) |
| `/amanecer/madrid/agosto` | 192,292 B | **147,965 B** (−23.1%) |
| `/amanecer/madrid` | 139,761 B | **95,368 B** (−31.8%) |
| `/vitamina-d/madrid` | 246,516 B | **202,183 B** (−18.0%) |
| sitemap URLs re-dated per deploy | 3,612 | **294** |

1. The 2,880 month pages and, via the route split, the 438 city pages left the ISR class — they
   are pure functions of (city, month, `DOY_REFERENCE_YEAR`) and nothing on their render path
   reads a clock.
2. `NextIntlClientProvider` stopped receiving the whole message file. See "The client only gets
   the namespaces it can read" below — that rule is the one with teeth.
3. `app/sitemap.ts` stopped stamping `new Date()` on everything. See "Copy changes to the month
   and city pages need a revision bump" below.
4. `/api/revalidate-today` became falsifiable: it reads three sampled hubs back and fails the run
   when the day they carry is neither today's nor yesterday's (`lib/hub-freshness.ts`). It used to
   return `{revalidated: 240}` unconditionally, because `revalidatePath` returns void.

### What is NOT established — do not write it down as fact

Two models both fit the write series, and they make different predictions. This has already
burned one pass of analysis, so it is recorded as an open question rather than answered:

- **Sweep model:** a pass over the ISR set costs one sweep (~35.5 K), and both a deploy and a day
  of revalidation write one.
- **Request-driven model:** reads and writes are the *same* requests — one document request that
  finds an expired ISR entry bills ~10 read units and ~10 write units. At ~3,200 document
  fetches/day that gives ~32 K reads and ~35 K writes per day, which is why the two meters are
  nearly equal instead of coincidentally equal.

Evidence that neither model absorbs cleanly: the 2026-08-16 deploy *added* 678 ISR pages and
billed only 8 K writes, a third of a zero-deploy day. And the last three days of the window
(no commits on any branch, ISR set at its largest) billed ~2,910/day total — almost exactly the
`/api/revalidate-today` cron's 240 hubs on its own, which is what "identical bytes are not
billed" predicts.

**The cheap experiment:** the month pages went static (`revalidate = false`) on 2026-08-22. Read
the write series a fortnight later. If writes fall to roughly the cron's ~2,200/day, the sweep
model was right. If they land near (remaining ISR page requests × ~10), the request-driven model
was. Until then, do not claim a per-deploy write cost — and note that the comment history got
this wrong once already: "at one hour this project hit the free ISR write quota within a day" is
a misattribution, since `revalidate = 3600` was live for only 15.7 hours (2026-08-16 19:55 →
2026-08-17 11:37) and the 200 K had already been crossed cumulatively around 2026-08-15.

### Facts about the plan itself

- **Hobby has no billing cycle.** The docs are explicit — limits reset by *"waiting until 30 days
  have passed"*, i.e. a rolling window, not a monthly zeroing. The dashboard's date selector
  (e.g. "Jul 23 – Aug 22") is a default 30-day *view*, not a cycle boundary; do not read a reset
  date into it.
- **Exceeding is a stop, not a bill.** There is no overage on Hobby. Sustained overuse leads to a
  paused deployment, at which point production serves `503 DEPLOYMENT_PAUSED`. For 3612 SEO URLs
  mid-indexing that is the expensive failure, not the $20.
- **Hobby is restricted to non-commercial personal use**, defined broadly by Vercel's fair-use
  terms (advertising a product or service, and even donations, count as commercial). The
  `/partners` page and the go-to-market work put this project outside that definition
  independently of any usage number.

**Reading the numbers:** the usage REST API (`/v1/usage`) is **Pro-only** — on Hobby it returns
`plan_upgrade_required`, and the CLI has no `usage` command. The only source is the dashboard at
`https://vercel.com/js-projects-98e2a0d2/~/usage` (per-path breakdowns need Observability Plus).

## Deployment (via GitHub Actions)

Deploys are automated in `.github/workflows/ci.yml` and **gated on green CI** (lint + typecheck + test + build):

- Push to `master` → `deploy-prod` job → production deploy of the `vitamind` project → getvitamind.app.
- Push to `dev` → `deploy-dev` job → Preview deploy aliased to the stable https://getvitamind-dev.vercel.app.

**A deploy is not cheap.** It runs the full quality gate and prerenders 3,634 routes — a ~22-minute
build, and a `dev` preview prerenders the identical set, so it costs the same as a production one.
Whether a deploy *also* costs ISR write units is the open question recorded under "Vercel plan and
usage limits" above; either way, batching changes beats pushing every one-line fix.

Both jobs use the `VERCEL_TOKEN` repo secret (GitHub → repo Settings → Secrets → Actions); the org/project IDs are inline in the workflow (not secrets). If a deploy job fails with an auth error, the token expired — create a new one at vercel.com/account/settings/tokens and update the secret.

**Before merging anything that includes a `supabase/migrations/*.sql`:** apply the migration to the shared Supabase project **first** (see "Supabase migrations" below) — the deploy on merge is automatic, so the DB must be ready before the code lands.

> **Shipped 2026-07-20 — sunrise SEO pages (wave 1):** 28 cities × 12 months ×
> 6 locales at `/amanecer/{city}/{month}` (localized prefixes/slugs in
> `lib/sun-routes.ts`, page at `app/[locale]/[cityPrefix]/[city]/[month]/`).
> Next waves (expand `SUNRISE_CITIES` toward all 73 when Search Console shows
> traction): `docs/plans/2026-07-19-sunrise-seo-pages.md`.

> **Shipped 2026-07-19/20 — MCP evolution:** 10 tools (6 public incl.
> `get_vitamin_d_year` + `estimate_sun_session`, 4 personal via OAuth 2.1),
> live-audited with agent user-simulations, hardened (rate limits, revocation
> UI in profile, lazy cleanup) and documented for users at `/connect`.
> Remaining marketing items (MCP directories, announcement) in
> `docs/plans/2026-07-19-mcp-evolution-account-marketing.md`.

> **Done — migration to the personal Vercel account.** The project no longer
> lives under the work-email account: team `js-projects-98e2a0d2` (`j's
> projects`), project id `prj_5Fe55OLq4R3Uk1zz1NCMwsB4jH7t`, with
> `getvitamind.app` attached to it (third-party registrar, Vercel nameservers)
> and `.github/workflows/ci.yml` already carrying that `VERCEL_ORG_ID` inline.
> Verified 2026-08-22 via `vercel project ls` / `vercel domains ls`. Anything
> that still says `javieraguilar-6355s-projects` is stale.

### Manual deploy (fallback)

The CLI link (`.vercel/project.json`) points to the `vitamind` project:

```bash
npx vercel --prod --yes      # manual production deploy → getvitamind.app
```

Note: after a `vercel rollback`, new deploys do **not** take the production domain automatically — promote with `npx vercel promote <deployment-url>`.

### Vercel project settings

- **Framework Preset:** Next.js (auto-detected on first deploy via `npx vercel --name <project>`; do **not** create the project with `vercel project add` because that creates it with preset "Other" and routes 404)
- **Root Directory:** repo root (the app is no longer in a `vitamind/` subdirectory — if a project still has Root Directory set to `vitamind`, clear it)
- **Build Command:** `npm run build` (also set in `vercel.json`)
- **Output Directory:** `.next` (default)

### Supabase migrations

`supabase/migrations/*.sql` are **not applied automatically**. After adding one, run it against the shared Supabase project (SQL editor or `supabase db push`) **before** deploying code that depends on it. Applied state worth knowing:

- `20260716_lock_down_anon_access.sql` removes the anon-role RLS policies on `push_subscriptions` (they exposed all subscriber endpoints/locations to anyone with the public anon key) and enables RLS on `city_names`. The app never used anon access to those tables — all server access uses the service role.

### IndexNow (instant indexing for Bing/Yandex/Seznam/Naver)

`deploy-prod` snapshots the live `sitemap.xml` **before** deploying, then after the
deploy submits only the URLs that snapshot lacked (`scripts/indexnow.ts --before`).
Logic and tests in `lib/indexnow.ts`; the key is `INDEXNOW_KEY` there and must stay
byte-identical to `public/<key>.txt` (a test enforces it — drift makes every
submission 403 silently). Google does not participate; its sitemap is resubmitted
manually in Search Console.

Two things worth knowing before touching it:

- The current URL list is generated by importing `app/sitemap.ts` (runs fine under
  `tsx` outside Next), **not** by fetching the deployed sitemap. Query strings are
  not part of the Vercel cache key for that route, so `?cb=` cache-busting does not
  work and a post-deploy read can be stale.
- Only new URLs are submitted. Re-submitting the whole sitemap on every deploy is
  what IndexNow treats as abuse. `--all` exists for the one-time bootstrap.

### Cron jobs

`vercel.json` defines two daily crons, both **Production only** (a `dev` preview never schedules them, so dev testing is manual via curl):

- `0 8 * * *` → `/api/push/notify`
- `10 0 * * *` → `/api/revalidate-today`, which regenerates the 240 hubs and then **verifies itself**: it fetches three sampled hubs, parses the calendar day out of their JSON-LD `Event` (`lib/hub-freshness.ts`), and returns 500 when the day is neither today's nor yesterday's, so a broken cron shows as a failed invocation instead of a cheerful `{revalidated: 240}`. Two days are allowed on purpose — it makes the verdict independent of the still-unresolved cache mechanism. The sample is `es/madrid`, `en/tokio`, `es/sidney`: the Event nodes drop on a city's DST transition day, so an all-European sample would go blind twice a year, and Asia/Tokyo has never observed DST.

You can check hub freshness yourself without the secret:

```bash
curl -s https://getvitamind.app/en/sunrise/oslo | grep -o '#sunrise-[0-9-]\{10\}'   # should be today
```

The endpoint authorizes via `Authorization: Bearer $CRON_SECRET` header only (set automatically by Vercel cron). The `?secret=` query-string variant was removed because it leaks the secret to logs/history; pass the secret in the header.

**Observability:** each run logs a JSON summary (`[api/push/notify] run finished…`) to the Vercel function logs — check it if pushes stop arriving. A run where *every* delivery fails returns 500, which Vercel surfaces as a failed cron invocation.

### Manual push test

```bash
# Prod (cron behaviour: only sends if UV ≥ 3 and a synthesis window exists)
curl -H "Authorization: Bearer $CRON_SECRET_PROD" https://getvitamind.app/api/push/notify

# Dev — same as above, runs against the dev-branch preview (Preview env CRON_SECRET)
curl -H "Authorization: Bearer $CRON_SECRET_DEV" https://getvitamind-dev.vercel.app/api/push/notify
```

### Force-test mode (`?force=true`)

For verifying push delivery end-to-end (without waiting for UV ≥ 3 or a synthesis window), `/api/push/notify` accepts `?force=true`. To prevent broadcasting test pushes to all real subscribers, the flag is gated by an env var:

- `PUSH_TEST_ALLOWED_ENDPOINT` — set in the **Preview environment only** (and **never in Production**) to a single subscription endpoint. When `force=true`, only that endpoint receives the push. Without the env var, the request returns 400. ⚠️ The current Preview value was copied from the retired vitamind-dev project and points at a subscription on the old origin — re-subscribe on https://getvitamind-dev.vercel.app and update it before force-testing.

```bash
# After subscribing on https://getvitamind-dev.vercel.app and setting PUSH_TEST_ALLOWED_ENDPOINT
curl -H "Authorization: Bearer $CRON_SECRET_DEV" \
  "https://getvitamind-dev.vercel.app/api/push/notify?force=true"
```

The push payload uses a fixed test body (`[Test HH:MM:SS] Push activo para <city>`); no attacker-controlled fields, even if `CRON_SECRET` leaks.

### Environment variables (Vercel dashboard, per project)

See `.env.example` for the full list with comments. Summary:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push VAPID keys (generate with `node scripts/generate-vapid.mjs`). **Production and Preview must each have their own pair** — pushes are isolated by public key.
- `VAPID_CONTACT` — `mailto:` contact push services can use (must be a monitored inbox).
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client credentials (same values in both environments)
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase operations, keep secret (same value in both environments)
- `CRON_SECRET` — Shared secret to authorize the Vercel cron endpoint. **Production and Preview must each have their own** so dev's secret can't be used to trigger prod.
- `PUSH_TEST_ALLOWED_ENDPOINT` — **Preview environment only.** Single subscription endpoint allowed to receive `?force=true` test pushes. Must NOT be set in Production (its absence is what keeps prod safe from `force=true`).

**Gotcha:** when adding env vars via CLI, always pipe with `printf '%s'` — never `echo`. `echo` appends a literal `\n` (bytes `5c 6e`) that Vercel stores inside the value, silently corrupting any secret that's pasted that way. Two known incidents on prod (`vitamind`):

1. VAPID keys corrupted at setup, broke push notifications for ~53 days before being detected on 2026-04-28.
2. The Supabase trio (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) was *also* corrupted at setup but the symptom was different: `getAllSubscriptions` and `saveSubscription` in `lib/push-store.ts` were swallowing the supabase-js `{ error }` payloads and returning empty/void, so the cron sent 0 pushes and the subscribe POST returned 200 without persisting anything. Detected and fixed on 2026-05-04 (~58 days corrupted) together with `lib/push-store.ts` raising on errors instead of swallowing them. `vitamind-dev` had the same corruption pattern and was fixed in the same session.

To detect future corruption: `npx vercel env pull --environment=production /tmp/x.env --yes && grep -cF '\n"' /tmp/x.env` should print `0`.

```bash
# Correct
printf '%s' "$VALUE" | npx vercel env add NAME production --force
# Wrong — adds trailing \n
echo "$VALUE" | npx vercel env add NAME production --force
```

## Push subscription isolation

Both projects share the same Supabase `push_subscriptions` table but filter by the `vapid_public_key` column (added in migration `20260428_push_vapid_public_key.sql`). `lib/push-store.ts` writes the current project's `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on every `saveSubscription` and filters on it in `getAllSubscriptions`. As a result, prod's cron only pushes to prod subscriptions and dev's cron only pushes to dev subscriptions, even though they share the table.

**Supabase access model:** browsers never touch `push_subscriptions` or `city_names` directly — everything goes through the API routes using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). RLS on those tables intentionally grants the anon role nothing (read-only for `city_names`). Do not add `using (true)` policies "to make something work" — fix the server path instead.

## Environment Variables (Local)

Copy `.env.example` to `.env.local` and fill in values.
