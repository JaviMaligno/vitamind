# The two UV sources, and why neither replaces the other

The app gets clear-sky UV from **two independent places**, and they disagree.
This file records by how much, why, and what follows — because the disagreement
is not small and the obvious conclusion ("pick the better one") is wrong.

## The two sources

| | `lib/uv-model.ts` | Open-Meteo |
|---|---|---|
| Used by | the 3,318 static SEO pages, the 240 hubs, every MCP clear-sky answer | the dashboard, the forecast row, `get_current_status` |
| Ozone | van Heuklon (1979) closed-form climatology | forecast/analysis ozone |
| Varies day to day | **no** — a function of (lat, lon, day-of-year) only | yes |
| Available for any date | **yes**, including next March at build time | no — a forecast horizon only |
| Needs the network | no | yes |

That last pair of rows is the whole argument. Read on before proposing a switch.

## The disagreement, measured

Sampled 2026-09-22 via the deployed MCP (`get_sun_forecast`, which returns
Open-Meteo's own peak UV and mean cloud per day), against our clear-sky peak for
the same city and day.

| City | ours (clear sky) | Open-Meteo (with cloud) | cloud | ratio |
|---|---|---|---|---|
| London 24 Sep | 3.23 | 3.2 | 58% | 0.99 |
| London 25 Sep | 3.17 | **4.2** | 34% | **1.33** |
| Madrid 22 Sep | 6.50 | 6.0 | 17% | 0.92 |
| Madrid 25 Sep | 6.24 | 5.9 | 8% | 0.95 |
| Sydney 25 Sep | 7.91 | 7.0 | 5% | 0.88 |
| Tokyo 22 Sep | 7.30 | 6.7 | 36% | 0.92 |
| **Nairobi 24 Sep** | **19.29** | **9.8** | 36% | **0.51** |

Two things in that table are not noise.

**A cloudy reading above our clear-sky ceiling is impossible.** Cloud only
subtracts. London on 25 September is Open-Meteo reporting 4.2 through 34% cloud
where we claim 3.17 is the maximum the sun can deliver. Either our number is too
low or theirs is too high; they cannot both stand. 2 of 25 sampled city-days
violate this.

**Nairobi is the other direction and much larger.** We publish a clear-sky peak
of 19.29 where Open-Meteo reports 9.8 through a third of a sky's worth of cloud.

## The mechanism: the ozone column

Inverting `uvIndex` for the ozone that would reproduce Open-Meteo's number on
the near-clear days (≤36% cloud):

| City | our ozone (van Heuklon) | ozone implied by Open-Meteo | Δ |
|---|---|---|---|
| London 25 Sep | 333 DU | 264 DU | −68 |
| Madrid 22–25 Sep | ~305 DU | ~323 DU | +18 |
| Sydney 24–26 Sep | ~315 DU | ~354 DU | +40 |
| Tokyo 22/24 Sep | ~305 DU | ~330 DU | +25 |
| **Nairobi** | **235 DU** | **408 DU** | **+173** |

At mid-latitudes the implied values stay inside the plausible range (250–360 DU)
and simply scatter — which is exactly what a **climatology with no day-to-day
term** looks like when compared against a forecast. Real total-column ozone
swings roughly ±50 DU at these latitudes from one week to the next, and
UVI ∝ (Ω/300)^−1.23, so ±50 DU is about ±20% in UV. London's −68 DU IS the 33%
discrepancy; nothing else needs explaining there.

Nairobi is different in kind. 408 DU is not a plausible equatorial column at
all, so no ozone value rescues the model form there. The likely contributor is
documented in `lib/uv-model.ts` itself:

> Its ~235 DU equatorial baseline runs ~15-25 DU below modern satellite-era
> equatorial means.

A 235 DU column applied to a near-zenith sun gives `(235/300)^-1.23 = 1.35`, a
35% uplift on the 12.5 base coefficient before the altitude gain compounds it.
The model is also only validated where CLAUDE.md says it was validated — Boston
Nov–Feb, Edmonton Oct–Mar, London Oct–Mar — which is **high-latitude winter, low
sun, every one of them**. The equatorial tropics were never checked.

For scale, the model's annual clear-sky maxima across the 73 built-in cities:

```
Bogota           20.3   (237 DU, 2640 m)
Nairobi          19.3   (235 DU, 1795 m)
Medellin         18.6   (238 DU, 1495 m)
Ciudad de Mexico 17.2   (264 DU, 2240 m)
Singapur         16.9   (235 DU,   15 m)
```

14 of 73 cities publish a clear-sky peak of 14 or more.

**This is an open question, not a settled verdict.** Open-Meteo could not be
queried directly from the environment these measurements were taken in (egress
policy), so its clear-sky field was never read — only its cloudy field, through
the MCP. Nobody has compared either model against a ground station. What IS
established is that the two disagree by a factor of two at high sun, that the
direction matches a known bias in our ozone input, and that our model has never
been tested outside high-latitude winter.

## Why Open-Meteo cannot simply replace the model

**It has no data for the dates the site is built from.** The 2,880 month pages,
the 438 city pages and the 24 sun-time pages are a pure function of
(city, day-of-year, `DOY_REFERENCE_YEAR`) and are prerendered. Answering "what
is the vitamin D window in Madrid in February" at build time is not a forecast
question, and a forecast API has nothing to say about it. Same for
`get_vitamin_d_year`, which walks all 365 days.

So the split stands: **a model where a date must be computed, a forecast where
one can be observed.** What should change is the quality of each side, not which
one exists.

## What follows

1. **Fetch `uv_index_clear_sky`.** It is another field on the `hourly=` request
   the app already makes — no extra call, no new dependency. It gives a
   same-source clear-sky reference, so cloud attenuation stops being measured by
   dividing their number by ours. It also lets the app answer the reader who can
   see a clear sky: *their* clear-sky value, rather than their cloud estimate.

2. **Re-base the ozone climatology.** van Heuklon is a 1979 fit to pre-1979
   data. A modern monthly lat-band table (OMI/TOMS era) is a few hundred numbers,
   embeds fine, needs no network, and would fix both the equatorial baseline and
   the seasonal shape. It would move the figures on all 3,318 pages, so it is a
   deliberate piece of work with a `lastmod` cost, not a drive-by.

3. **Already done: the ratio method.** `getCurrentStatus` reads the forecast's
   *attenuation* — its value divided by our clear-sky value at the same hour —
   and applies it to the five-minute solar curve. Because it is a ratio, a bias
   in our model cancels, so the live answer tracks Open-Meteo's numbers even
   where the two models disagree on absolutes. This is why the dashboard is
   correct today despite everything above.
