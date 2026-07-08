# Spec: i18n URL Routing for SEO (#1 of the SEO track)

**Date:** 2026-07-08
**Branch:** `feat/i18n-routing`
**Baseline tag:** `pre-i18n-routing`

## Problem

The app is fully translated into 6 languages (es, en, fr, de, ru, lt) but Google
can only index one of them. Measured on production (2026-07-08):

- **No per-language URLs.** next-intl runs in "no routing" mode (no middleware, no
  `[locale]` segment). Locale is resolved by cookie `locale` → `Accept-Language` →
  `es`, all served on the *same* URL. `curl https://getvitamind.app/?locale=fr`
  returns `<html lang="es">` — the `?locale=` query param declared in the current
  sitemap is dead; nobody reads it.
- **hreflang is invalid.** `sitemap.ts` declares `alternates.languages` as
  `?locale=xx` URLs that all serve the same Spanish content → Google sees 6
  duplicate URLs, not 6 languages.
- **Canonical is wrong.** `app/layout.tsx` hardcodes `canonical: "/"`, so every
  page tells Google its canonical is the home.
- **Content is served variably by header on one URL** — a caching/indexing
  anti-pattern; only one variant gets indexed.

Net effect: 5 of 6 translations are invisible in search, and non-home pages
canonicalize to the home.

## Goal & success criteria

Deliver real per-language URLs so each translation is independently indexable.

**Measurable success (verified by smoke test):**
- Each of the 6 UI pages is served at 6 real URLs (36 total).
- Each URL returns the correct `<html lang="xx">` and body text in that language
  (today `?locale=fr` returns `lang="es"`; must become `lang="fr"` at `/fr`).
- Every page declares a **self-referencing** `canonical` (its own localized URL).
- Every page declares valid `hreflang` alternates for the 6 languages + `x-default`.
- Old URLs 301-redirect: `?locale=xx` → `/xx/...`; `/es/...` → `/...`.

**Out of scope (separate PRs):** per-city pages (#2) and expanded content (#3).
This PR delivers routing + hreflang/sitemap/canonical only.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Prefix strategy | `as-needed` | Default `es` stays prefix-free (`/`, `/learn` unchanged); other locales get `/xx`. Preserves current URLs, keeps home clean, fewer redirects. |
| Default locale | `es` | Occupies the prefix-free URLs; matches current default. |
| First-visit detection | On, via redirect | New visitor with FR browser → 302 `/fr`. Keeps current UX but through a real URL instead of header-variant content. |
| `x-default` target | `/` (prefix-free root) | The autodetecting entry point. |

## Architecture — file structure

Move the UI under a `[locale]` segment; leave non-localized routes (API, sitemap,
robots) outside it.

```
app/
  [locale]/              NEW segment wrapping all UI
    layout.tsx           moved: <html lang>, NextIntlClientProvider, AppShell,
                         generateStaticParams() → 6 locales (SSG per language),
                         generateMetadata() → self-referencing canonical + hreflang
    page.tsx             moved: home
    learn/ dashboard/ explore/ partners/ profile/ offline/   moved
  api/                   unchanged (not localized)
  sitemap.ts  robots.ts  unchanged location (special routes)
  layout.tsx             root becomes a passthrough: `return children` (the
                         <html>/<body> move into [locale]/layout.tsx)

i18n/
  routing.ts             NEW: defineRouting({ locales, defaultLocale:'es',
                         localePrefix:'as-needed', localeDetection:true })
  navigation.ts          NEW: createNavigation(routing) → localized Link/useRouter/
                         usePathname/redirect
  request.ts             MODIFIED: read locale from the [locale] segment
                         (requestLocale); cookie becomes override only

middleware.ts            NEW: compose ?locale= redirect + createMiddleware(routing)
```

With `as-needed`, the middleware internally rewrites `/learn` → `/es/learn` for the
default locale, so every page resolves through `[locale]` even though Spanish has
no public prefix. next-intl also 301-redirects `/es/...` → `/...` to avoid
duplicate content.

## Navigation & LanguageSelector

**Rule:** swap Next navigation imports for the localized wrappers from
`@/i18n/navigation`. `href` values stay the same; the wrapper adds the locale
prefix (`/learn` → `/fr/learn` under `/fr`, `/learn` under `es`).

Files with `<Link>` to migrate (`next/link` → `@/i18n/navigation`):
`BottomTabBar.tsx` (also `usePathname` for active tab), `HeroZone.tsx` (2),
`VitDEstimate.tsx`, `dashboard/page.tsx` (3), `profile/page.tsx` (2),
`explore/page.tsx` (2), `learn/page.tsx`, `partners/page.tsx`.

Programmatic navigation: `app/page.tsx:10` `router.replace("/dashboard")` →
`useRouter` from `@/i18n/navigation` (resolves to the current locale).

`usePathname` from the wrapper returns the path **without** locale prefix, so
`BottomTabBar`'s active-tab comparison (`pathname === "/dashboard"`) keeps working
across all 6 languages unchanged.

**LanguageSelector.tsx** — the real conceptual change. Today: set cookie +
`router.refresh()` on the same URL. New:
```ts
const router = useRouter();      // @/i18n/navigation
const pathname = usePathname();  // path without prefix
router.replace(pathname, { locale: lang });   // same page, other language
```
Pressing "EN" on `/fr/learn` goes to `/en/learn` (not the home). next-intl
persists the preference cookie automatically.

**Cookie reconciliation (decided):** `request.ts` currently reads cookie `locale`
(written by `lib/locale.ts`); next-intl defaults to writing `NEXT_LOCALE`. To keep
the change surface small, **configure next-intl's routing to reuse the existing
`locale` cookie name** (`localeCookie: { name: "locale" }`) rather than renaming.
`lib/locale.ts` and `PushLocaleSync` are then untouched; `PushLocaleSync` keeps
reading `useLocale()` (no functional change; locale now comes from the URL segment).

**Unchanged:** anchors (`#supplement`), API routes, message catalogs
(`messages/*.json`).

## Redirects, canonical, hreflang, sitemap

- **Static prerender:** `generateStaticParams()` in `[locale]/layout.tsx` returns
  the 6 locales → Next builds all 6 variants per page (SSG).
- **Self-referencing canonical:** replace the fixed `canonical: "/"` with
  `generateMetadata()` per page; each page+locale canonicalizes to its own URL.
- **hreflang:** each page declares its 6 language alternates + `x-default` → `/`.
  Example for `/learn`: canonical `/learn`; hreflang es `/learn`, en `/en/learn`,
  fr `/fr/learn`, de `/de/learn`, ru `/ru/learn`, lt `/lt/learn`; x-default `/`.
- **Sitemap 6 → 36 URLs:** rewrite `sitemap.ts` to emit each of the 6 pages × 6
  locales with the prefix rule (es prefix-free, rest `/xx`), each entry carrying
  its full `alternates.languages` block. Drop the current `?locale=` URLs.
- **Old-URL redirects (301):** `?locale=xx` → `/xx/...` (in the middleware wrapper,
  before next-intl's middleware, stripping the query); `/es/...` → `/...` (handled
  by next-intl `as-needed`).
- **JSON-LD:** the layout's structured data declares `inLanguage` of the current
  page locale instead of the fixed array.

## Verification

**Automated (TDD where it pays off):**
- `sitemap.ts` unit test: exactly 36 URLs, correct prefixes (es prefix-free, rest
  `/xx`), full `alternates` block per entry.
- Routing unit test: `getPathname` per (locale, page) — `/learn` in `en` = `/en/learn`,
  in `es` = `/learn`.

Middleware end-to-end is **not** unit-tested (mocking NextRequest/redirects is
brittle and low-value); redirects are verified by the post-deploy smoke test.

**Smoke test (reproducible curl script, same as the audit baseline):**
- `curl -sI` each redirect: `?locale=fr` → 301 `/fr`; `/es/learn` → 301 `/learn`.
- `curl -s` `/`, `/en`, `/fr/learn` → assert `<html lang="xx">` and body text in
  that language.
- Assert `<link rel="alternate" hreflang>` present and self-referencing `canonical`.
- Compare against baseline (today `?locale=fr` served `lang="es"` → must be `lang="fr"`).

## Deployment

1. Deploy to **`vitamind-dev`** → run full smoke test there. This is a large routing
   change; it does not go straight to prod.
2. Regression check: navigation (`BottomTabBar`), deep-links (`/learn#supplement`),
   **push notifications** (push locale after the cookie change), and that the
   **service worker** does not serve stale cached routes (the `buildCommand` already
   regenerates `CACHE_NAME` per deploy).
3. Deploy to **prod** → smoke test on prod.
4. Post-deploy: resubmit the sitemap in Google Search Console to speed re-crawl.

## Risks

- **Cookie name mismatch** between next-intl and `request.ts`/`PushLocaleSync` →
  handled explicitly in "Cookie reconciliation".
- **Service-worker cache** serving pre-migration routes → covered by the existing
  `CACHE_NAME` regeneration; verify in the dev smoke test.
- **Googlebot redirect on `/`** → mitigated by full sitemap + valid hreflang so each
  language URL is discoverable directly, not only via the autodetecting root.
