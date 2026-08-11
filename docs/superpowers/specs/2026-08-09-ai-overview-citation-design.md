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
| Granularity | 40 cities | thousands, down to districts (Chamartín, Les Corts) |
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

## Goal, and what it is worth

Be cited by Google's AI Overview for sun-timing and vitamin D queries.

We do not control the ranking system, so the operational goal is to **maximise every known
source-selection factor and measure the citation as the outcome metric**. Every phase below
carries a signal that says whether its lever worked, and a named next lever if it did not.

**What a citation is worth in clicks, stated up front so the project is judged against
something real.** The 2026 figures do not agree with each other, and the disagreement is
itself informative:

- Pew (March 2025): users click a source *inside* the AI summary about **1 %** of the time.
  The attribution is not a traffic channel.
- Being cited returns roughly **35 % more organic clicks** than not being cited, plus ~12 %
  more direct traffic and ~9 % more brand search.
- With an AI Overview present, users click some organic result in **8 %** of visits; without
  one, **15 %**.

Applied here: from a base of 75 clicks per 90 days, winning citations plausibly moves us to
the order of **100 clicks per 90 days, not 700**. The compounding gains — direct traffic and
brand search — are real but slower and harder to attribute.

This is stated because the alternative is to ship three phases against an unstated
expectation nothing supports. The citation target stands; it is the owner's explicit call.
What changes is that success is measured as *citation count first, click delta second*.

**And there is almost no way around the AI Overview.** The 2026-08-10 baseline (10 fixed
queries, `data/aio-tracking/`) returned **9 of 10 with an AI Overview and 0 citations for
us**. One query — `what time is sunset in toronto in august` — carried no overview at all,
which corrects the "5 out of 5" reading of the day before: an AIO-free segment exists, it is
just small enough that it cannot carry the strategy. We appear at all in exactly one of the
ten, organically, 2088 px into a 2772 px page.

## Decisions taken

1. **Authorship now, medical review later.** Own methodology and author pages ship in phase
   1; the `reviewedBy` structure is built and emitted only when a reviewer constant exists,
   so adding a clinician later is a data change, not a redesign.
2. **Freshness via daily ISR in the served HTML.** Not client-side, because the datum has to
   be in the HTML that gets crawled and extracted.
3. **Vitamin D as a wedge inside the solar pages.** One asset attacks both territories:
   the 2880 month pages already draw the impressions; the synthesis window is what nobody
   else can compute.
4. **Own citation checker in the repo**, not a paid provider — with the transport kept
   swappable (see phase 3).

## Delivery shape

**One phase, one implementation plan, one PR, with a checkpoint between them** — the
project's standing rule. The phases below are not a single plan: 1a ships and is reviewed
before 1b is written, and so on. Phase 3's baseline capture is the exception and runs
*before* phase 1a lands, because a baseline taken after the changes measures nothing.

Order, cheapest-evidence-first: **3-baseline → 1a → 1b → 2 → 3-recurring**. Phase 1a is
deliberately first among the code changes because it is the only authority work with direct
evidence behind it (see phase 1), it is small, and it makes every later phase attributable.

## Phase 1 — Authority foundations

Ships first because the E-E-A-T filter runs *before* passage re-ranking. Extractable prose
on a site with no authorship signals is written for a filter that already discarded it.

**The gate is not the same height in both territories, and that was measured.** Alpenglow —
cited for sun-timing queries — serves this in its global layout:

```json
"author": { "@id": "https://alpenglowapp.com/#organization" }
```

`Organization` + `Person` + `author`, and that is all: **no methodology page, no `reviewedBy`,
no `dateModified`**, and the only trust-shaped links in its chrome are Contact and Privacy.
Meanwhile the sources cited for vitamin D queries are dermatologists and clinics. So:

- **Phase 1a — entity graph.** The demonstrated minimum for the sun-timing territory, and
  cheap: `Organization`, `Person`, `author` with stable `@id`s, `sameAs`. This is the part
  with direct evidence behind it, so it ships first and alone.
- **Phase 1b — methodology and bibliography.** The bet for the health territory, where the
  cleared sources hold clinical credentials. Higher cost, weaker evidence, still worth doing
  because it is also what makes the `reviewedBy` slot meaningful when a clinician exists.

`dateModified` drops from "required" to "worth having": alpenglow is cited without it. The
freshness that demonstrably matters is the one visible in the text ("Aug 8"), not the one in
the markup — which reinforces phase 2 and de-prioritises schema plumbing.

### Phase 1a — entity graph and the author page

**Schema**, extracted into a new `lib/schema.ts` (today's JSON-LD is inline and scattered):
`Organization` as publisher with stable `@id` and `sameAs`; `Person` as `author`, referenced
from content pages by `@id`; `reviewedBy` emitted only when a reviewer constant is present.
`dateModified` is included because it is nearly free, not because it is required.

**`/about`**: short. The person behind it, why it exists, link to `javieraguilar.ai`. This is
what the `Person` node points at — a schema `Person` with no page behind it is an assertion
with nothing to verify.

This is the whole of 1a: one module, one page, one navigation change. It is small on purpose.

### Phase 1b — methodology and bibliography

**`/methodology`** (unlocalised route, localised content, matching `/learn` and `/connect`):
how every number is produced — solar geometry (`solar.ts`), the Madronich UV model with van
Heuklon ozone (`uv-model.ts`), MED by Fitzpatrick phototype and the age factor (`vitd.ts`).
The 45° *in vitro* / 50° conservative thresholds, stated and justified. The bibliography
above, visible and linked. **Known limits** (clear-sky, no shade or albedo, population-level
estimate not individual advice) and a **model changelog** — July's UV model correction is
real material and is precisely the signal that separates a source from a page generator.

Plus `citation` on the pages that use the model, pointing at those references.

Every data page links to `/methodology` with text that says what is there, not "learn more".
Authority nothing links to is authority on an island.

**Navigation.** Each subphase adds its own page to the top navigation, the mobile menu and
the footer as it ships — `/about` with 1a, `/methodology` with 1b. The mobile header is
already tight (see the July UI audits), so adding two entries is a layout decision, not an
extra `<li>`.

**Tests, 1a:** JSON-LD emitted and shape-valid — `Organization` and `Person` present with
stable `@id`s, `author` resolving to the `Person`, ISO `dateModified`, and `reviewedBy`
absent while no reviewer constant exists and present once one does.

**Tests, 1b:** bibliography present and identical across the six locales; the methodology
copy renders in all six; `messages/__tests__/health-claims.test.ts` stays green — that guard
already exists and 1b edits medical copy.

## Phase 2 — Extractable content, freshness, the wedge

### Split-city design, added 2026-08-10

This spec admits above that a weekly 10-query sample detects citations but cannot attribute
them to a phase. That is true of phase 2 as written — and phase 2 is the one worth knowing
about, because it is the expensive one.

So it ships to **half the sunrise cities**. 40 cities, 20 treated and 20 held back, matched
in pairs by GSC impressions so the groups are comparable rather than split at random: the
two highest-volume cities go one to each group, then the next two, and so on. Same dates,
same domain, same crawl budget, same authority — the only difference is the passage.

- Both groups move together → something else caused it (an algorithm update, the phase 1
  work landing, seasonality).
- Treated move, control does not → the passage is the lever, and the remaining 20 ship
  immediately.
- Neither moves → the passage is not the lever, and the next one is authority, which we
  already know is untouched.

Cost: half the potential benefit arrives later. Bought: the first answer in this project
that is a cause rather than a correlation. Given that everything measured so far has
contradicted the intuition that preceded it — 5/5 became 9/10, four locales to cut became
two, an "18-reference" migration was 51 — that trade is worth taking.

**Constraints on the split, so it stays honest:**

- Pair by impressions, not alphabetically or by latitude. Madrid and Valencia must not land
  in the same group.
- Record the assignment in `data/aio-tracking/` before shipping, alongside each city's
  impressions at assignment time. An assignment reconstructed afterwards proves nothing.
- The control group is not "worse pages" — it is the current pages, unchanged. Nothing is
  degraded to make a comparison look better.
- One deadline: if the treated group has not moved 12 weeks after Google has recrawled it,
  the passage is not working and the control group ships anyway rather than staying a
  monument to an experiment.

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

**Template-mass risk, mitigated by design rather than by volume.** 2880 pages carrying a
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

Transport:

| Channel | Measured result |
|---|---|
| `curl` with a Chrome UA | HTTP 200, 91 KB anti-scraping shell. No results, no AIO |
| Chromium headless (Playwright) | `/sorry/index` on **query 1** |
| Real Chrome, headed (`channel: chrome`) | `/sorry/index` on **query 1** |
| User's Chrome, real profile and session, via extension | 13 queries across the day, no block |

SERP landscape, five of our own highest-impression GSC queries:

| Query (GSC impressions) | AIO | Cited | Organic |
|---|---|---|---|
| what time is sunset in tokyo in may (55) | yes | no | absent |
| a que hora anochece en londres en marzo (47) | yes | no | absent |
| a que hora anochece sevilla (23) | yes | no | absent |
| a qué hora amanece en tenerife (22) | yes | no | absent |
| puesta de sol barcelona diciembre (14) | yes | no | present, 1335 px into a 2758 px page |

Alpenglow appears in 2 of the 5. timeanddate in 3. We appear in 1, below the fold.

The rejection is not about pacing and not about headless — it is about being automated. No
interval tuning fixes it. **Phase 3 therefore cannot run in CI, in cron, or on a runner.**

### Design

**Detecting "cited" is harder than it looks, and the baseline capture proved it.** Deciding
whether our link sits inside the overview by DOM containment produces false positives: the
matched container wrapped both the overview and the organic results, so a link 1880 px below
the overview reported as cited. The reliable signal is geometric — the link's absolute top
against the overview block's bottom — and the analyser must bound the block properly rather
than matching the smallest element carrying the label. Any claim of a citation gets refuted
by position before it is recorded.

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

Google must crawl, index and re-evaluate 2880 pages. The realistic judging window is **4–12
weeks**, and the first sign of progress is recrawl and position movement, not the citation.

Each phase has a signal and a named successor lever:

- Phase 1a shows nothing → the entity graph was not the gate either; next lever is entity
  *coverage* (alpenglow-style granularity: districts and municipalities, not just capitals —
  it is the other structural difference we measured, and the one we chose not to buy yet).
- Phase 1b shows nothing in the health territory → clinical credentials are the real gate
  there, and the answer is the medical reviewer, not more content.
- Phase 2 shows nothing in 12 weeks → the constraint is raw domain authority; next lever is
  links, known outstanding since July (7 links from 2 domains).
- Citation earned in one territory only → double down on the one that worked.

None of these branches is "it could not be done". Each is the next thing to do.

**One honest caveat about attribution.** With a weekly 10-query sample we can detect whether
citations appear, not attribute them cleanly to one phase — Google recrawls on its own
schedule and the phases ship weeks apart, not in a controlled experiment. The sequencing
above (cheapest-evidence-first, one phase per PR, baseline before anything) is what buys as
much attribution as this setup allows. Claiming more would be dressing up a guess.

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
