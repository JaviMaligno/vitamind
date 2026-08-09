# AI Overview citation — earning the cite Google currently hands to clinics

Date: 2026-08-09
Branch: `feat/aio-citation` (from `master`)

## Why

The site works. That is the problem.

Search Console on 2026-08-09, over 8 May → 7 Aug: **75 clicks, 23,000 impressions, 0.3 %
CTR, average position 9.9**. The July baseline was 39 impressions in 90 days, so the
programmatic sunrise pages did exactly what they were built to do — they reached the SERP.
What they do not do is earn a click.

Position is not the cause. Measured per page:

| Page | Impressions | Clicks | CTR | Position |
|---|---|---|---|---|
| `/amanecer/madrid/agosto` | 1013 | 5 | 0.5 % | 11.7 |
| `/en/sunrise/london/august` | 458 | 1 | 0.2 % | **7.2** |

London sits on page one and converts at 0.2 %, where position 7 normally returns 3–4 %.
Reading the live SERPs explains it: `sunset london august` and `a que hora anochece en
madrid en agosto` both open with an AI Overview that answers the question completely
("el sol se pone entre las 21:51 y las 20:38 durante el mes de agosto"), followed by
People Also Ask. Organic results are below the fold. **getvitamind.app is not among the
cited sources**; alpenglowapp, timeanddate, SunToday and the Instituto Geográfico Nacional
are.

The vitamin D pages — the actual product — draw **32 impressions and 0 clicks in 90 days**
at position 7.8. They rank; nobody searches for them. Google Trends (Spain, 12 months) puts
`vitamina d sol` at roughly one fifth the volume of `a que hora anochece`, and its rising
related queries are encyclopaedic ("el sol es vitamina c o d", +110 %), not tool-shaped.

So the click is gone from the queries that have volume, and volume is absent from the
queries where a calculator is needed. The remaining prize is the citation itself, and it is
a different competition: 2026 research puts the share of AI Overview citations that also
rank in the organic top 10 at ~38 % (Ahrefs) to ~17 % (BrightEdge), down from ~76 % in
mid-2025. Ranking neither guarantees nor gates the cite.

### What the cited sources have that we do not

Alpenglow is the instructive comparison: a small app, no timeanddate-scale authority, cited
anyway.

| | getvitamind | Alpenglow |
|---|---|---|
| Granularity | 28 cities | thousands, down to districts (Chamartín, Les Corts) |
| Time frame | generic month, fixed reference year | **today**, "updated daily" |
| Snippet | "Amanecer y atardecer en Madrid en agosto" | "El amanecer en Madrid es a las 7:18 AM en Aug 8" |
| Unique datum | vitamin D window (invisible) | sunset quality forecast |
| Page types per city | 1 | 5 |

Three gaps follow: **freshness** (our pages declare they are not of the current year),
**extractability** (our content lives in table cells, while citations are built from
self-contained prose passages), and **an unused differentiator** (nobody else computes a
real synthesis window; when Google answered "la síntesis es muy escasa o nula" it cited a
care home).

A fourth gap outranks all of them. E-E-A-T functions as a binary gate — ~96 % of citations
go to sources that clear it — and in a YMYL/health niche the cleared sources are
dermatologists and clinics. Our site currently ships **zero authorship signals**: no
methodology page, no author page, and a schema graph of `WebApplication`, `FAQPage`,
`WebPage`, `CollectionPage` with no `Organization`, no `author`, no `dateModified`, no
`reviewedBy`. Search Console's Search Appearance report reads **"Sin datos"** — the
`FAQPage` markup we already serve earns no enhanced appearance at all. The markup is not
the missing piece; the trust attached to it is.

Meanwhile the raw material for that trust already exists, buried in `messages/*.json`:
Holick 1982 *Science* 216(4549):1001-1003, Holick 2013 *Dermato-Endocrinology* 5(1):51-108,
de Gruijl 2016, Madronich, van Heuklon.

## Goal

Be cited by Google's AI Overview for sun-timing and vitamin D queries.

We do not control the ranking system, so the operational goal is to **maximise every known
source-selection factor and measure the citation as the outcome metric**. Every phase below
carries a signal that says whether its lever worked, and a named next lever if it did not.

## Decisions taken

1. **Authorship now, medical review later.** Own methodology and author pages ship in phase
   1; the `reviewedBy` structure is built and emitted only when a reviewer constant exists,
   so adding a clinician later is a data change, not a redesign.
2. **Freshness via daily ISR in the served HTML.** Not client-side, because the datum has to
   be in the HTML that gets crawled and extracted.
3. **Vitamin D as a wedge inside the solar pages.** One asset attacks both territories:
   the 2016 month pages already draw the impressions; the synthesis window is what nobody
   else can compute.
4. **Own citation checker in the repo**, not a paid provider — with the transport kept
   swappable (see phase 3).

## Delivery shape

**One phase, one implementation plan, one PR, with a checkpoint between them** — the
project's standing rule. The three phases below are not a single plan: phase 1 ships and is
reviewed before phase 2 is written. Phase 3's baseline capture is the exception and runs
*before* phase 1 lands, because a baseline taken after the changes measures nothing.

## Phase 1 — Authority foundations

Ships first because the E-E-A-T filter runs *before* passage re-ranking. Extractable prose
on a site with no authorship signals is written for a filter that already discarded it.

**`/methodology`** (unlocalised route, localised content, matching `/learn` and `/connect`):
how every number is produced — solar geometry (`solar.ts`), the Madronich UV model with van
Heuklon ozone (`uv-model.ts`), MED by Fitzpatrick phototype and the age factor (`vitd.ts`).
The 45° *in vitro* / 50° conservative thresholds, stated and justified. The bibliography
above, visible and linked. **Known limits** (clear-sky, no shade or albedo, population-level
estimate not individual advice) and a **model changelog** — July's UV model correction is
real material and is precisely the signal that separates a source from a page generator.

**`/about`**: short. The person behind it, why it exists, link to `javieraguilar.ai`. This
anchors the schema `Person`.

Both pages go in the top navigation and the mobile menu as well as the footer. The mobile
header is already tight — see the July UI audits — so this needs care, not just an extra
link.

**Schema**, extracted into a new `lib/schema.ts` (today's JSON-LD is inline and scattered):
`Organization` as publisher with `sameAs`; `Person` as `author`, referenced from content
pages; real `dateModified` per page; `citation` pointing at the references on pages that use
the model; `reviewedBy` emitted only when the reviewer constant is present.

Every data page links to `/methodology` with text that says what is there, not "learn more".
Authority nothing links to is authority on an island.

**Tests:** JSON-LD emitted and shape-valid (author present, ISO `dateModified`, `reviewedBy`
absent without a reviewer and present with one); bibliography present in all six locales;
`messages/__tests__/health-claims.test.ts` stays green — that guard already exists and this
phase edits medical copy.

## Phase 2 — Extractable content, freshness, the wedge

**The citable passage.** A new pure module, `lib/sun-prose.ts`, generating a self-contained
~150-word paragraph per city and month. Self-contained means it survives being torn out of
the page, so it opens by naming city, month and year. It carries the data only we hold
together: latitude, first- and last-day sunrise and sunset, minutes gained or lost across
the month, mid-month day length, peak solar elevation, and **the vitamin D synthesis window
with minutes required for a mid-range phototype**. Entity-dense and factual: city, country,
UVB, Fitzpatrick phototype, latitude.

**Today, without lying.** A December page visited in August cannot say "today". The rule: if
the page's month is the current month, the header carries **today's date and today's
figures**; otherwise "en `<month>` de `<current year>`" using day 15 as reference. Either way
`dateModified` is real. The footnote stops reading "pueden variar uno o dos minutos según el
año" and becomes "calculado para `<year>`; los valores varían uno o dos minutos entre años" —
equally honest, now dated.

**ISR.** `export const revalidate = 86400` on the month and city pages. On-demand
regeneration, not a daily rebuild of 2496 pages.

**Template-mass risk, mitigated by design rather than by volume.** 2016 pages carrying a
generated paragraph can read as bulk generation. The wording branches on the real solar
regime of that city and month: wide synthesis window, no synthesis possible at any hour, or
polar day/night. Three structurally different texts because the facts differ. That variation
is genuine, and it is also the most citable part — *"en Madrid en diciembre no hay síntesis
de vitamina D a ninguna hora"* is a concrete claim no clinic currently publishes with the
computation behind it.

**Tests:** the generator is pure, so it is tested whole — length in range, required figures
and entities present, all three regimes, agreement between the paragraph and the table on the
same page, six locales. Plus a served-HTML test asserting the passage ships in the markup and
not only the table, which is the entire point.

## Phase 3 — Measurement

### Experimental evidence (measured 2026-08-09, blocking for the design)

| Channel | Measured result |
|---|---|
| `curl` with a Chrome UA | HTTP 200, 91 KB anti-scraping shell. No results, no AIO |
| Chromium headless (Playwright) | `/sorry/index` on **query 1** |
| Real Chrome, headed (`channel: chrome`) | `/sorry/index` on **query 1** |
| User's Chrome, real profile and session, via extension | 8 queries in one sitting, no block |

The rejection is not about pacing and not about headless — it is about being automated. No
interval tuning fixes it. **Phase 3 therefore cannot run in CI, in cron, or on a runner.**

### Design

**The checker is an analyser, not a scraper.** The browser obtains the SERP through the human
channel; a pure repo module receives that text and extracts AIO presence, cited domains,
whether we are among them, and organic position. Splitting transport from analysis is what
makes it genuinely testable: tests run against saved SERP fixtures with no network, covering
the cases already observed — English AIO ("AI Overview"), Spanish AIO ("Vista creada con IA"),
a SERP with no AIO, a consent wall, and the `/sorry` page.

**Verification characteristics:**

- **Fixed, versioned query set** — 10 queries, selected by an explicit rule so the choice is
  reproducible: the 6 highest-impression queries from the GSC 3-month report that already
  return an AI Overview (4 Spanish, 2 English, spanning at least 4 distinct cities), plus 4
  vitamin D queries with measurable Trends volume. Fixed once chosen, because the series is
  only comparable against itself; changing the set starts a new baseline.
- **Cadence: one session per week, 10 queries maximum, ≥15 s apart.** This number is *not*
  derived by probing for the limit and will not be. Finding it means triggering a block on
  the user's real Google account — the same account that reaches Search Console. It comes
  from what was observed on 2026-08-09 (8 queries at human pace, no incident) with margin.
- **Hard stop:** on the first `/sorry`, captcha or consent wall the session aborts, records
  the incident, and does not retry.
- **Dated record** per run in versioned JSON, plus a screenshot per query as evidence.
- **Baseline captured before any code changes**, or nothing downstream is attributable.

**Escape hatch, designed not purchased:** the analyser accepts input from any source, so
swapping in a paid provider — which can run daily and without the user's account — changes
the transport and preserves the entire historical series.

## Horizon and failure criteria

Google must crawl, index and re-evaluate 2016 pages. The realistic judging window is **4–12
weeks**, and the first sign of progress is recrawl and position movement, not the citation.

Each phase has a signal and a named successor lever:

- Phase 1 shows nothing → E-E-A-T was not our gate; next lever is entity coverage
  (alpenglow-style granularity: districts and municipalities, not just capitals).
- Phase 2 shows nothing in 12 weeks → the constraint is raw domain authority; next lever is
  links, known outstanding since July (7 links from 2 domains).
- Citation earned in one territory only → double down on the one that worked.

None of these branches is "it could not be done". Each is the next thing to do.

## Out of scope

Binding, per the project's anti-scope-creep rule:

- Expanding `SUNRISE_CITIES` from 28 to 73. Marginal click return is near zero and it would
  multiply impressions that already fail to convert. Revisit only if phase 1's signal points
  at entity coverage.
- Link building. Real and outstanding, but a different project.
- MCP promotion. Its audience — people who wire up an MCP server — is too narrow to be the
  main lever here. Announcement only.
- Paid AI-visibility tooling. Interface prepared, nothing contracted.
- Anything that would make a page assert a figure it cannot compute.
