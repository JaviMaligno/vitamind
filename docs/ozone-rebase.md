# Runbook: re-basing the ozone climatology

**State: ready to run, not run.** Everything except the network call is written
and tested. This environment could not reach Open-Meteo or NASA (egress policy
refused CONNECT to `api.open-meteo.com`, `acd-ext.gsfc.nasa.gov` and
`ozonewatch.gsfc.nasa.gov`), so the sampling step has never executed against
real data. Run it somewhere with outbound HTTPS and the rest follows.

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
npx tsx scripts/ozone-sample.ts --from 2026-07-01 --to 2026-10-05
```

Appends to `data/ozone-samples.json`, deduplicating on (city, hour), so it is
safe to re-run. It keeps only hours with the sun above 30°, which is where
Madronich's formula is stated valid and therefore the only place inverting it
for ozone means anything.

**You will need several runs spread across the year.** The forecast host serves
UV for a window around today — `lib/weather-range.ts` puts it at about 92 days
back, and roughly a fortnight forward. One run covers a season, not a year. The
script prints the span each city actually returned, so check that rather than
assuming. If you find a source with a longer UV archive, point `ENDPOINT` at it;
nothing downstream cares where the numbers came from.

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

Paste the printed module over `lib/ozone-table.ts`. That is the whole change —
no call site moves, because they already go through `ozoneColumn`.

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
