# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VitaminD Explorer is a solar vitamin D synthesis calculator PWA. It helps users determine when and where they can synthesize vitamin D based on solar elevation angles, UV index, skin type, body exposure, and age. Built with Next.js App Router, deployed on Vercel.

## Development Commands

All commands run from the `vitamind/` directory:

```bash
cd vitamind
npm run dev       # Dev server at localhost:3000
npm run build     # Production build
npm start         # Start production server
npm run lint      # Next.js ESLint
```

There are no tests configured in this project.

## Architecture

### Next.js App Router (`vitamind/app/`)

- **`page.tsx`** — Main single-page app (~21KB). Manages all top-level state (selected city, date, skin type, UV data, etc.) and orchestrates child components. Heavy use of React hooks.
- **`layout.tsx`** — Root layout with PWA manifest link and service worker registration.
- **`api/weather/route.ts`** — Proxies Open-Meteo API for UV index and cloud cover data.
- **`api/push/subscribe/route.ts`** — Manages web-push subscription CRUD in Supabase.
- **`api/push/notify/route.ts`** — Cron-triggered endpoint (daily 8 AM via Vercel cron) that sends push notifications to subscribed users with their vitamin D window.

### Core Libraries (`vitamind/lib/`)

- **`solar.ts`** — Solar geometry: declination, elevation angle, sunrise/sunset, day curves. Pure math, no side effects.
- **`vitd.ts`** — Vitamin D synthesis calculations: Minimal Erythemal Dose (MED) by Fitzpatrick skin type, age factor, minutes needed for synthesis.
- **`cities.ts`** — Built-in database of 50+ cities with coordinates, timezones, and flags.
- **`types.ts`** — Core TypeScript interfaces: `City`, `SolarPoint`, `VitDWindow`, `UserProfile`.
- **`storage.ts`** — LocalStorage persistence layer (favorites, custom locations, preferences).
- **`profile.ts`** — Supabase profile sync for authenticated users.
- **`push-store.ts`** — Supabase push subscription management (uses service role key). Reads/writes are scoped to the current Vercel project's `NEXT_PUBLIC_VAPID_PUBLIC_KEY` so the prod and dev projects don't see each other's subscriptions on the shared `push_subscriptions` table.
- **`supabase.ts`** — Supabase client initialization.
- **`geonames.ts`** — GeoNames API integration for city search.
- **`geo.ts`** — TopoJSON decoding for world map rendering.

### Components (`vitamind/components/`)

D3.js-based visualizations: `WorldMap.tsx` (interactive map with UV overlay), `GlobalHeatmap.tsx` (year/latitude heatmap), `DailyCurve.tsx` (solar elevation curve with VitD windows). User controls: `CitySearch.tsx` (Fuse.js fuzzy search), `SkinSelector.tsx`, `VitDEstimate.tsx`, `NotificationToggle.tsx`, `AuthButton.tsx`, `SaveLocationModal.tsx`.

### Data Flow

1. User selects city (or clicks map) → lat/lon/timezone set in `page.tsx` state
2. `solar.ts` computes day curve (elevation angles for every minute)
3. `vitd.ts` determines synthesis windows using MED thresholds adjusted for skin type, body area, and age
4. Weather API fetched for real UV index → refines synthesis estimate
5. D3 components render visualizations from computed data

### PWA

- Service worker at `public/sw.js` (cache-first for static assets, network-only for API)
- Manifest at `public/manifest.json` for standalone mobile install
- Icons generated via `scripts/generate-icons.js` (SVG → PNG via Sharp)

## Key Technical Details

- **Path alias:** `@/*` maps to project root (configured in `tsconfig.json`)
- **Tailwind CSS v4** with `@tailwindcss/postcss` plugin
- **`web-push`** is listed in `serverExternalPackages` in `next.config.ts` to avoid client bundling
- **Vercel cron:** configured in `vercel.json` — `0 8 * * *` hits `/api/push/notify`
- All components use `"use client"` directive (client-side rendering with D3)

## Environments

There are **two Vercel projects**, both in scope `javieraguilar-6355s-projects`. The repo is **not** linked to either — deploys are manual via CLI.

| Env | Vercel project | Public URL | Purpose |
|---|---|---|---|
| **Production** | `vitamind` | https://getvitamind.app (alias: `vitamind-six.vercel.app`) | Stable, what users and partners see |
| **Dev / staging** | `vitamind-dev` | https://vitamind-dev.vercel.app | Personal testing (e.g. push notifications). Not for partners. |

Each project has its own VAPID keys, `CRON_SECRET`, and Supabase env vars (the Supabase project is shared, but `push_subscriptions` are isolated per project — see "Push subscription isolation" below).

## Deployment (Vercel)

The Next.js app lives in `vitamind/`. The default `.vercel/project.json` link points to the **prod** project (`vitamind`).

### Deploy to production

```bash
cd vitamind
npx vercel --prod --yes      # deploys to vitamind → getvitamind.app
```

### Deploy to dev (vitamind-dev)

The CLI link must be swapped temporarily because there's only one `.vercel/` per working dir:

```bash
cd vitamind
npx vercel link --project vitamind-dev --yes   # relink to dev
npx vercel --prod --yes                        # deploys to vitamind-dev → vitamind-dev.vercel.app
npx vercel link --project vitamind --yes       # relink back to prod (so future default deploys go to prod)
```

`--prod` here means "production deployment of the dev project" — i.e. the deployment that gets the canonical alias `vitamind-dev.vercel.app`. It does **not** affect prod.

### Vercel project settings (both projects)

- **Framework Preset:** Next.js (auto-detected on first deploy via `npx vercel --name <project>`; do **not** create the project with `vercel project add` because that creates it with preset "Other" and routes 404)
- **Root Directory:** `vitamind` (must be set since the repo root is not the app root)
- **Build Command:** `next build` (default)
- **Output Directory:** `.next` (default)

### Cron jobs

`vercel.json` defines a daily cron `0 8 * * *` UTC hitting `/api/push/notify`. Because `vercel.json` is committed, **both projects** schedule it. To silence the dev cron without touching `vercel.json`, disable the schedule from the `vitamind-dev` project's dashboard.

The endpoint authorizes via `Authorization: Bearer $CRON_SECRET` header (set automatically by Vercel cron) or a `?secret=$CRON_SECRET` query param for manual testing.

### Manual push test

```bash
# Prod
curl -H "Authorization: Bearer $CRON_SECRET_PROD" https://getvitamind.app/api/push/notify
# Dev
curl "https://vitamind-dev.vercel.app/api/push/notify?secret=$CRON_SECRET_DEV"
```

### Environment variables (Vercel dashboard, per project)

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push VAPID keys (generate with `node scripts/generate-vapid.js`). **Each project must have its own pair** — pushes are isolated by public key.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client credentials (same values in both projects)
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase operations, keep secret (same value in both projects)
- `CRON_SECRET` — Shared secret to authorize the Vercel cron endpoint. **Each project must have its own** so dev's secret can't be used to trigger prod.

**Gotcha:** when adding env vars via CLI, always pipe with `printf '%s'` — never `echo`. `echo` appends a literal `\n` that Vercel stores inside the value, silently corrupting VAPID keys (this happened to prod and broke push for ~53 days before being detected on 2026-04-28).

```bash
# Correct
printf '%s' "$VALUE" | npx vercel env add NAME production --force
# Wrong — adds trailing \n
echo "$VALUE" | npx vercel env add NAME production --force
```

## Push subscription isolation

Both projects share the same Supabase `push_subscriptions` table but filter by the `vapid_public_key` column (added in migration `20260428_push_vapid_public_key.sql`). `lib/push-store.ts` writes the current project's `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on every `saveSubscription` and filters on it in `getAllSubscriptions`. As a result, prod's cron only pushes to prod subscriptions and dev's cron only pushes to dev subscriptions, even though they share the table.

## Environment Variables (Local)

Required in `.env.local`:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push VAPID keys
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase operations
- `CRON_SECRET` — Authorization for Vercel cron endpoint
