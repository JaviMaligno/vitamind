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
- **`app/[locale]/[cityPrefix]/[city]/page.tsx`** — SEO city pages with localized route prefixes AND slugs (`/vitamina-d/madrid` ↔ `/en/vitamin-d/madrid`). `lib/city-routes.ts` + `i18n/metadata.ts` build the hreflang alternates.
- **`app/[locale]/error.tsx`, `app/[locale]/not-found.tsx`, `app/global-error.tsx`** — error boundaries; localized copy under the `errorPage`/`notFoundPage` message keys.
- **`app/api/weather/route.ts`** — Proxies Open-Meteo (UV index, cloud cover). Validates lat/lon/dates, 8s upstream timeout, opaque error responses.
- **`app/api/cities/route.ts`** — Server-side city search against Supabase (localized RPCs with fallbacks).
- **`app/api/push/subscribe/route.ts`** — Push subscription CRUD (validates/clamps all input).
- **`app/api/push/notify/route.ts`** — Cron-triggered (daily 8 AM UTC via Vercel cron) push broadcaster. Auth: `Authorization: Bearer $CRON_SECRET`. Logs a run summary; returns 500 if every delivery fails so Vercel marks the cron run failed.
- **`app/api/mcp/[transport]/route.ts`** — Remote MCP server (`mcp-handler`, stateless Streamable HTTP at `/api/mcp/mcp`; no Redis, so no SSE transport). Exposes four public read-only tools (`search_city`, `get_sun_times`, `get_vitamin_d_window`, `get_current_status`) so users can connect the app to Claude/ChatGPT as a custom connector. Tool logic lives in `lib/mcp-tools.ts` (pure, unit-tested in `lib/__tests__/mcp-tools.test.ts`); no auth by design — everything it serves is public calculation. Connector URL: `https://getvitamind.app/api/mcp/mcp` (dev: `https://getvitamind-dev.vercel.app/api/mcp/mcp`).

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

## Key Technical Details

- **Path alias:** `@/*` maps to repo root (`tsconfig.json`)
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **`web-push`** is in `serverExternalPackages` (`next.config.ts`) to avoid client bundling
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.) are set in `next.config.ts` for every deploy. If a new external origin is needed (script/style/fetch), add it to the CSP there — do not remove the header.
- **Vercel cron:** `vercel.json` — `0 8 * * *` hits `/api/push/notify`
- Interactive components use `"use client"`; city pages and layouts are server components for SEO.

## Environments

Both environments live in the single Vercel project `vitamind` (scope `javieraguilar-6355s-projects`), separated by Vercel environment:

| Env | Git branch | Vercel environment | Public URL | Purpose |
|---|---|---|---|---|
| **Production** | `master` | Production | https://getvitamind.app (alias: `vitamind-six.vercel.app`) | Stable, what users and partners see |
| **Dev / staging** | `dev` | Preview | https://getvitamind-dev.vercel.app | Personal testing (e.g. push notifications). Not for partners. |

The Preview environment has its **own** VAPID keys, `CRON_SECRET` and `PUSH_TEST_ALLOWED_ENDPOINT` (copied from the retired `vitamind-dev` project), so push subscriptions stay isolated between prod and dev — see "Push subscription isolation" below. The old standalone `vitamind-dev` project was deleted on 2026-07-17.

## Deployment (via GitHub Actions)

Deploys are automated in `.github/workflows/ci.yml` and **gated on green CI** (lint + typecheck + test + build):

- Push to `master` → `deploy-prod` job → production deploy of the `vitamind` project → getvitamind.app.
- Push to `dev` → `deploy-dev` job → Preview deploy aliased to the stable https://getvitamind-dev.vercel.app.

Both jobs use the `VERCEL_TOKEN` repo secret (GitHub → repo Settings → Secrets → Actions); the org/project IDs are inline in the workflow (not secrets). If a deploy job fails with an auth error, the token expired — create a new one at vercel.com/account/settings/tokens and update the secret.

**Before merging anything that includes a `supabase/migrations/*.sql`:** apply the migration to the shared Supabase project **first** (see "Supabase migrations" below) — the deploy on merge is automatic, so the DB must be ready before the code lands.

> **Planned (future) feature:** dedicated programmatic SEO pages for
> sunrise/sunset by city+month (`/amanecer/madrid/julio`). Approved but parked
> until Search Console shows traction on solar queries — full plan in
> `docs/plans/2026-07-19-sunrise-seo-pages.md`.

> **Planned (next) work:** MCP tool optimization (yearly vitamin D tool to stop
> per-date call cascades), account value ladder + OAuth 2.1 for personal MCP
> tools, and the "connect your AI" marketing push — full plan in
> `docs/plans/2026-07-19-mcp-evolution-account-marketing.md`.

> **Planned (bigger) change:** migrate the project to the personal Vercel
> account (`js-projects-98e2a0d2`, GitHub `JaviMaligno` login) to stop using the
> work-email account for personal projects. `getvitamind.app` is registered at a
> third-party registrar (not Vercel), so the move is: recreate env vars in the
> personal project (printf discipline!), verify the deployment URL end-to-end,
> then move the domain. Push subscribers survive because the origin and VAPID
> keys stay the same. Native Git integration works there (that account owns the
> `JaviMaligno` GitHub connection).

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

### Cron jobs

`vercel.json` defines a daily cron `0 8 * * *` UTC hitting `/api/push/notify`. Crons only run on **Production** deployments, so the `dev` branch preview never schedules it — dev push testing is manual via curl (below).

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
