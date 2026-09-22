# Runbook: re-basing the ozone climatology

**State: run on 2026-09-22 and NOT adopted.** The fit halved the error against
Open-Meteo and broke all three measured anchors; `lib/ozone-table.ts` still
ships empty. Numbers and reasons under *The 2026-09-22 run* at the end of this
file. **Do not simply re-run this procedure expecting a different verdict** —
read that section first: the failure is structural, not a matter of more data.

The runbook was written in an environment with no network, and the first real
run found three things it had wrong. All are fixed below and in the code:

- **Open-Meteo stamps an hourly reading at the END of the hour it describes.**
  The sampler took the sun angle at the stamp, which pairs every morning reading
  with a sun half an hour too high. It now takes it at the centre of the hour.
  Evidence on `FORECAST_STAMP_LAG_H` in `lib/vitd.ts`.
- **One run covers whole years, not a season.** The historical forecast host
  (`historical-forecast-api.open-meteo.com`) keeps `uv_index_clear_sky` back to
  2022; the 92-day limit is the live host's. The sampler now reads the former.
- **The non-negotiable check was not checking.** `uv-literature.test.ts` read
  `ozoneDU` — the fallback — so it passed 16/16 with a table that failed every
  measured anchor. It now reads `ozoneColumn`, the column the app uses.

Read `docs/uv-sources.md` first for *why* — the short version is that
`ozoneDU` is van Heuklon (1979), a closed-form fit to pre-1979 data with no
day-to-day term, and measured against Open-Meteo it is wrong in both directions:
~69 DU high over London, ~173 DU low over Nairobi. The error changes sign with
latitude, so nudging its baseline cannot fix it, and
`lib/__tests__/uv-model-bias.test.ts` fails anyone who tries.

## What is already in place

| | |
|---|---|
| `lib/ozone-table.ts` | the table the app reads, and `lookupOzone`. **Ships empty**, so every cell falls back to van Heuklon and today's behaviour is unchanged. |
| `lib/uv-model.ts` → `ozoneColumn(lat, lon, doy)` | the seam. Every app call site already goes through it; `ozoneDU` remains as the 1979 fit and the fallback. |
| `lib/ozone-fit.ts` | inversion, binning, fitting. Pure. |
| `scripts/ozone-sample.ts` | the only part that needs the network. |
| `scripts/ozone-fit.ts` | fits, reports, prints the module. Writes nothing. |
| `lib/__tests__/ozone-fit.test.ts` | 12 tests, including a round trip that manufactures observations from a known field and demands the fit recover it (worst case under 12 DU), smoothness across the new year, and proof that the seam is *exactly* `ozoneDU` while the table is empty. |

## The procedure

### 1. Collect samples

```bash
npx tsx scripts/ozone-sample.ts --from 2023-09-01 --to 2026-08-31
```

Appends to `data/ozone-samples.json`, deduplicating on (city, hour), so it is
safe to re-run. It keeps only hours with the sun above 30°, which is where
Madronich's formula is stated valid and therefore the only place inverting it
for ozone means anything.

Three whole years took about three minutes for the 73 cities and wrote 464,287
samples (~60 MB, gitignored). Whole years matter more than recent ones: a
climatology should not carry one year's anomaly. The script prints the span each
city actually returned, so check that rather than assuming.

Aim for coverage in every populated latitude band in every month the sun gets
above 30° there. The fit leaves thin cells `null` rather than guessing, and
`lookupOzone` degrades band by band, so a partial table is usable — it just
helps fewer places.

### 2. Fit and read the report

```bash
npx tsx scripts/ozone-fit.ts
```

It prints coverage, how far each band moves from van Heuklon, the residual
before and after, and the module to paste. It **exits non-zero and tells you not
to adopt** if the new table does not beat van Heuklon on the samples it was
fitted to.

Against synthetic data the pipeline takes a 13.2% mean UV residual down to 0.8%.
Real data will be worse; what matters is the direction and that the improvement
is large enough to be worth a re-crawl.

### 3. Adopt

Replace the `OZONE_TABLE` constant in `lib/ozone-table.ts` with the one the
script prints — the constant only: the file also holds `lookupOzone` and the
types. No call site moves, because they already go through `ozoneColumn`.

### 4. Verify, in this order

```bash
npx vitest run lib/__tests__/uv-literature.test.ts   # FIRST. Non-negotiable.
npm run typecheck && npm run lint && npm test
npm run build
```

`uv-literature.test.ts` is the one that matters. It holds measured anchors —
Webb, Kline & Holick (1988) for Boston and Edmonton, UK SACN (2016) for London —
plus year-round classes for Singapore, Miami, Bogotá and Nairobi. **A table that
breaks those is wrong, however good its residual looks.** Those anchors are the
only real ground truth in this repository; the samples are one provider's model.

Then expect these to fail, and handle them deliberately:

- **`lib/__tests__/content-revision.test.ts`.** The figures on all 3,318
  prerendered pages move. Paste the new hashes **and move the three dates** —
  this is a genuine content change, unlike the seam itself. Read
  `lib/content-revision.ts` on how that decision is made and what it costs: a
  re-crawl on a plan whose ISR Reads closed their last window at 125%.
- **`lib/__tests__/uv-model-bias.test.ts`.** It records the disagreement this
  work exists to close. When it closes, that file should be rewritten to assert
  the new agreement, not deleted — the samples in it are the evidence for the
  change.
- **`lib/__tests__/uv-model.test.ts`** pins van Heuklon itself (`ozoneDU(0,0,·) ≈
  235`). It should keep passing: `ozoneDU` is not being changed, only demoted to
  a fallback. If it fails, something touched the wrong function.

Then look at the real pages before pushing — `/vitamina-d/nairobi`,
`/vitamina-d/bogota`, `/amanecer/singapur`. Nairobi and Bogotá are where the
present model publishes clear-sky peaks above 19, and they are the visible test
of whether this helped.

## Two things to decide, not to assume

**Longitude stops mattering where the table has coverage.** van Heuklon carries a
small longitude term; a zonal table does not. That is a real, small change for
cities at the same latitude in different hemispheres of the globe. It is
defensible — the zonal signal dominates — but it is a choice, and it should be
made knowingly.

**The output is a calibration, not a measurement.** `impliedOzone` inverts *our*
`uvIndex` for the column that reproduces *their* clear-sky UV. Any systematic
difference between the two radiative-transfer models lands in that number. It is
the ozone-shaped parameter that makes our formula agree with theirs, which is
exactly what the static pages need — but nobody should publish it as an ozone
dataset, and `lib/ozone-fit.ts` says so at the top.

## The 2026-09-22 run

Samples: Sep 2023 - Aug 2026, 73 cities, 464,287 hours with the sun above 30°,
no failures. Coverage 123/216 cells; the 45° bands and everything above 65°N
were empty because no city sits there.

| | van Heuklon | fitted table |
|---|---|---|
| In-sample mean UV error vs Open-Meteo | 23.3% | 11.2% |
| **Held-out year** (fit Sep 2023 - Aug 2025, test Sep 2025 - Aug 2026) | 23.7% | 11.3% |
| Cities worse on the held-out year | | 0 / 73 |
| Nine live-forecast samples in `uv-model-bias.test.ts` (mean DU error) | 47 | 31 |
| Zenith peak, Nairobi / Bogotá | 19.3 / 20.1 | 11.4 / 12.7 |
| **Boston, Webb et al. 1988** (no synthesis Nov-Feb) | passes | **fails: gains February** |
| **Edmonton, Webb et al. 1988** (Oct-Mar) | passes | **fails: gains March** |
| **London, SACN 2016** (Oct-Mar) | passes | **fails: gains March** |

**Why it fails, and why more data will not fix it.** Even with the hours
aligned, the ratio of Open-Meteo's clear-sky UV to ours is U-shaped through the
day — London on 21 June 2025 runs 1.54 -> 0.79 -> 1.20 from morning to evening
— so the two models differ in how UV falls off with a lower sun, not only in
level. A single ozone number per cell can only move the level. Fitted to all
hours, it lowers the column wherever the sun is low, and "wherever the sun is
low" is exactly the high-latitude shoulder months the anchors pin. The fitted
column says as much about itself: 320-370 DU over the equator, and at 65°N a
cycle running from 247 DU in March to 305 in June — the real high-latitude
cycle peaks in spring at 400+ DU, so this one is inverted.

So the table improved agreement with a model and worsened agreement with
measurements. Either Open-Meteo is too generous at low sun, or the UVI-3
threshold stands in imperfectly for previtamin-D production at low sun, or both;
the anchors do not say which, and that question is the real next step — not
another ozone fit. If anything is fitted to Open-Meteo in future, it has to be
the elevation dependence in `uvIndex` as well, and `uv-literature.test.ts` has
to pass on the result.

The rejected table is not committed. To reproduce it: the two commands in steps
1 and 2 with the date range above.
