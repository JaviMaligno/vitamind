# Spec: Programmatic Per-City SEO Pages (#2 of the SEO track)

**Date:** 2026-07-09
**Depends on:** #1 i18n URL routing (done — `app/[locale]/`, `buildLanguageAlternates`, `as-needed` prefix).

## Problem & goal

The app has near-zero organic traffic. People search vitamin-D questions tied to a
place ("can I make vitamin D in winter in London?", "vitamin d london"). Today the
app has no indexable page targeting those queries. Goal: generate one static,
genuinely-useful landing page per city × locale, capturing long-tail search and
funneling visitors into the calculator — seeded now (July) to mature for the
autumn/winter search peak.

Success = 73 cities × 6 locales = **438 statically-generated pages**, each with real
computed solar/vitamin-D data (not templated filler), correct localized URL,
self-referencing canonical, hreflang across the 6 variants, and `FAQPage` schema.

## Scope

**In (Phase 1):**
- The 73 `BUILTIN_CITIES` (already have translated names in all 6 locales via the
  `cities.<slug>` message keys).
- Localized URLs (city slug + path prefix in each language).
- Build-time computed content per city (no runtime network).
- Sitemap/robots/hreflang extension.
- A new `cityPage` message namespace with ICU templates in all 6 locales.

**Out (explicitly, to prevent scope creep):**
- Scaling beyond the 73 curated cities into `cities15000.json`'s 33k (future phase:
  needs latitude-dedup + translated names via the Supabase `city_names` table).
- Making the global FAQ (`/learn`) prominent in navigation — see the SEO roadmap
  backlog; it's a separate UX change.
- A heavy interactive per-city visualization. The year profile ships as a static
  server-rendered SVG; optional hydration is a later enhancement, not this PR.

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| City set | 73 builtin | Translated names already exist; latitudes well-dispersed → no near-duplicates; zero thin-content risk. |
| URL slug | Localized (per-locale) | Users search the city name in their own language; the slug in the URL is a strong ranking signal. |
| Path prefix | Localized, ASCII | `vitamina-d`/`vitamin-d`/`vitamine-d`/`vitamin-d`/`vitamin-d`/`vitaminas-d`. Keyword in the path; ASCII for clean URLs. |
| Slug for non-Latin locales (ru) | ASCII transliteration, fallback to base slug | Cyrillic percent-encoded URLs are ugly; transliterate `Лондон` → `london`/`moskva`. If slugify yields empty/collision, fall back to the Spanish base slug. |
| Rendering | Static server component (SSG) | Content must be in the initial HTML for SEO; pure functions make it deterministic at build. |
| Year profile viz | Static SVG (server-rendered) | Indexable, no JS cost. |
| #3 content | Absorbed | The supplement block + per-city FAQ cover most of it; residual = expand `/learn` later. |

## URL scheme

Localized path prefix + localized city slug, under the existing `[locale]` segment
(default locale `es` is prefix-free). Examples:

```
es:  getvitamind.app/vitamina-d/madrid
en:  getvitamind.app/en/vitamin-d/london
fr:  getvitamind.app/fr/vitamine-d/londres
de:  getvitamind.app/de/vitamin-d/london
ru:  getvitamind.app/ru/vitamin-d/moskva
lt:  getvitamind.app/lt/vitaminas-d/londonas
```

The city slug is derived deterministically by slugifying (with ASCII
transliteration) the localized name from `cities.<baseSlug>`. Slugs are stable
across builds (pure function of the name) and MUST be unique per locale (verified
by a test). hreflang links the 6 variants of the same city; canonical
self-references.

## Page content (per city, all computed in build)

1. **H1 + verdict.** "Vitamina D del sol en {city}" + the key sentence, e.g. *"In
   London you can synthesize April–September; October–March it's impossible."*
   Derived by sweeping `vitDHrs(lat, doy, MIN_UVI_ELEVATION)` over `doy = 1..365`
   and finding the contiguous possible-months band.
2. **Year profile.** Which months are possible/impossible, as a static SVG strip
   (reuse the heatmap logic — `vitDHrs` per day at the city's latitude, the
   `GlobalHeatmap` color ramp). Unique per city.
3. **Seasonal windows.** Time-of-day and minutes needed in each season, via
   `getCurve(lat, lon, doy, tz)` → `computeExposureFromCurve(...)` on representative
   days (e.g. the solstices/equinoxes).
4. **When to supplement.** Shown for the impossible months: D3/K2/magnesium
   guidance. This block is the concrete inventory to show a partner (Marnys).
5. **CTA to the calculator.** Deep-links into the app with the city preselected —
   converts SEO visitors into users.
6. **Per-city FAQ** with `FAQPage` JSON-LD: "Can I make vitamin D in winter in
   {city}?" etc. Long-tail + rich-result eligible.

## Architecture — files

| File | Responsibility | Action |
|---|---|---|
| `lib/city-routes.ts` | Localized slug ↔ cityId per locale; per-locale path prefix; `generateStaticParams` list (438); per-city hreflang alternates | Create |
| `lib/city-content.ts` | Pure build-time computation per city: possible-months band, seasonal windows, supplement flag — from `solar.ts`/`vitd.ts` | Create |
| `app/[locale]/[cityPrefix]/[city]/page.tsx` | Static server component: resolves city from (locale, slug), computes content, renders HTML + FAQ schema + `generateMetadata` (canonical/hreflang) + `generateStaticParams` | Create |
| `components/CityYearStrip.tsx` | Static SVG year-profile strip (server component) | Create |
| `messages/*.json` (`cityPage` namespace) | ICU templates in all 6 locales | Modify (×6) |
| `app/sitemap.ts` | Add the 438 city URLs (× hreflang), using `buildCityAlternates` from `lib/city-routes.ts` | Modify |
| `lib/solar.ts` / `lib/vitd.ts` | Reused as-is (pure functions); no change expected | — |

City hreflang/canonical live in `lib/city-routes.ts` as `buildCityAlternates(cityId)`
(returns `{ canonical: string; languages: Record<string,string> }`, mirroring the
shape of `buildLanguageAlternates` but with per-locale localized slugs). The city
page and the sitemap both consume it. `i18n/metadata.ts` is unchanged — its
`buildLanguageAlternates` stays for the non-city routes.

Note on the dynamic prefix segment: because `[cityPrefix]` sits beside the static
siblings (`dashboard`, `explore`, `learn`, …), the page must validate that the
prefix matches the locale's expected value and `notFound()` otherwise, so
`/en/dashboard/x` doesn't fall into the city route.

## Translations (the bulk of the work)

A new `cityPage` namespace per locale with ICU templates: `title`, `verdict`
(`{city}`, `{startMonth}`, `{endMonth}`), `seasonalWindow`, `supplement`, and FAQ
Q/A templates. Month names come from `Intl.DateTimeFormat(locale, {month:"long"})`,
NOT the hardcoded Spanish arrays in `solar.ts`/`GlobalHeatmap`. The city name comes
from the existing `cities.<baseSlug>` keys. **The user reviews the copy** (tone,
correctness) — this is where content quality lives.

## SEO plumbing

- **Sitemap:** +438 entries (on top of the existing 36), each with
  `alternates.languages` = the 6 localized city URLs + x-default (the es version of
  that city), from `buildCityAlternates`.
- **Canonical:** each city page self-references its localized URL.
- **hreflang:** the 6 localized variants of the same city + x-default → es variant.

## Verification

**Automated (TDD):**
- `lib/city-routes.ts`: slug is deterministic; `(locale, slug) → cityId` round-trips
  for all 73 × 6; slugs are unique per locale; `generateStaticParams` yields 438.
- `lib/city-content.ts`: sanity per latitude — Reikjavik (64°N) has impossible
  winter months; Singapore (1°N) is possible year-round; Sydney (−33°S) has its
  impossible band in the northern summer. Asserts the possible-months logic.
- `app/sitemap.ts`: total count = existing + 438; every city entry has 6 language
  alternates + x-default; no `?locale=`.

**Smoke (post-deploy, extend `scripts/smoke-i18n.sh`):**
- A localized city URL per locale returns 200 with correct `<html lang>` and the
  city name in the body.
- Canonical self-references; hreflang present; `FAQPage` JSON-LD present.

**Content review:** the user reviews the 6-locale `cityPage` copy before prod.

## Deployment

Same as #1: deploy to `vitamind-dev` → smoke + spot-check a few cities across
locales → deploy to prod → resubmit sitemap in Search Console. Note the build now
generates ~470 static pages; confirm build time stays acceptable.

## Risks

- **Slug collisions / instability** → deterministic slugify + per-locale uniqueness
  test; fall back to base slug on collision.
- **Dynamic-prefix route swallowing static siblings** → strict prefix validation +
  `notFound()`.
- **Thin/duplicate content** → mitigated by real per-city computed data and the
  73-city dispersed-latitude set; not scaling to 33k in this phase.
- **Build time** → 438 extra SSG pages; monitor, all pure/deterministic so cacheable.
