# Spec: Fix the clear-sky UV model

**Date:** 2026-07-09
**Branch:** `fix/uv-model` (off `master`)
**Blocks:** `feat/city-pages` — the per-city SEO pages state, as indexable fact, which months synthesis is possible. They must not publish falsehoods.

## Problem

`lib/vitd.ts` estimates the clear-sky UV index as:

```ts
estimateUVFromElevation(elevationDeg) = 12 * sin(elevationDeg)^1.3
```

Its own docstring admits it "ignores clouds, ozone, altitude". Ozone is precisely what
absorbs UVB at low sun, which is the regime that decides whether a vitamin-D winter
exists. The model therefore **overestimates by 3–4× at low sun**:

| Solar elevation | Current model | Madronich (Ω=300) | Reality |
|---|---|---|---|
| 20° | **2.98** | 0.93 | ≈0.75–0.9 |
| 30° | 4.87 | 2.34 | ≈2 |
| 45° | 7.65 | 5.40 | ≈3.5–5 |

`MIN_UVI_ELEVATION` is derived by inverting it for UVI = 3, giving **20.14°** (the
`// ~19.1 degrees` comment beside it is also stale). The consequence is that the app
asserts **Boston, New York, Madrid, Chicago and Toronto synthesize vitamin D all
twelve months**, contradicting Webb, Kline & Holick (1988). 51 of the 73 builtin
cities come out `allYear`.

Because `estimateUVFromElevation` also feeds `computeExposureFromCurve`, the app has
been **under-advising exposure time**: it thinks there is more UV than there is.

## Chosen model — selected by experiment, not by authority

Three candidate engines were run against the literature anchors. Scoring is against
the two **measured** anchors (Webb/Kline/Holick 1988 measured 7-DHC → previtamin-D3
conversion in ampoules) plus the UK's SACN 2016 statement.

| Engine | Boston (want Nov–Feb) | Edmonton (want Oct–Mar) | London (want Oct–Mar) |
|---|---|---|---|
| current `12·sin^1.3` | **no impossible months** | 3 months | 3 months |
| Madronich, fixed Ω=300 | 3 months | 5 months | 5 months |
| **Madronich + van Heuklon ozone** | **Nov–Feb** ✓ | **Oct–Mar** ✓ | **Oct–Mar** ✓ |
| Allaart/TEMIS + van Heuklon | Oct–Feb ✗ | 7 months ✗ | Oct–Mar ✓ |

**Madronich + van Heuklon reproduces all three exactly.** Adopted.

### The equations

**UV index** — Madronich, S. (2007), "Analytic formula for the clear-sky UV index",
*Photochemistry and Photobiology* 83(6):1537–1538, DOI 10.1111/j.1751-1097.2007.00200.x:

```
UVI = 12.5 · μ^2.42 · (Ω/300)^-1.23        μ = cos(SZA) = sin(elevation)
```

Stated validity: SZA 0–60° (elevation ≥ 30°), ozone 200–400 DU, cloud-free, low
albedo, sea level. Accuracy ~10%.

**This is not Fioletov's formula** — a common misattribution. Fioletov regresses UV on
global solar radiation, ozone, dew point and snow cover, and uses no power law.

**Validity argument (important):** we only ever use this model *near* UVI = 3, and the
elevation where UVI = 3 lies between **30.4° (250 DU) and 39.9° (400 DU)** — inside
Madronich's stated range. The current model places that threshold at 20.14°, outside
the validity range of any published parameterization. Below 30° elevation, `uvIndex`
is extrapolation; it is still monotonic and small, and is only used to answer "is this
below 3?", never as a reported UVI value.

**Ozone** — van Heuklon, T. K. (1979), "Estimating atmospheric ozone for solar
radiation models", *Solar Energy* 22(1):63–68, DOI 10.1016/0038-092X(79)90060-4:

```
Ω = J + [A + C·sin(D·(doy + F)) + G·sin(H·(lon + I))] · sin²(B·lat)      [degrees]
```

| Coefficient | Northern (lat ≥ 0) | Southern (lat < 0) |
|---|---|---|
| J | 235 | 235 |
| A | 150 | 100 |
| B | 1.28 | 1.5 |
| C | 40 | 30 |
| D | 0.9865 | 0.9865 |
| F | −30 | 152.625 |
| G | 20 | 20 |
| H | 3 | 2 |
| I | +20 if lon > 0 else 0 | −75 |

Known limitations, to be documented in code: fitted to **pre-ozone-hole** climatology
(does not reproduce the Antarctic hole), and its equatorial baseline of 235 DU is
~15–25 DU below modern satellite means. It captures the latitude/season *shape*, which
is what moves the threshold.

**Altitude** — UV increases with elevation. The published spread is wide (5–25 %/km;
WHO quotes ~10 %/1000 m; Allaart uses +5 %/km; Blumthaler measured ~18 %/km in summer).
We adopt **+8 %/km**, a defensible central value, applied multiplicatively:

```
UVI(elevation_m) = UVI_sealevel · (1 + 0.08 · elevation_m/1000)
```

This matters at the boundary for Bogotá (2640 m, +21%), Mexico City (2240 m, +18%),
Johannesburg (1753 m, +14%), Denver (1609 m, +13%), Nairobi (1795 m, +14%).

**Threshold:** synthesis is possible on a given day iff the clear-sky noon UVI ≥ 3.
Expressed as an elevation, this is no longer a constant — it depends on latitude,
longitude, day of year (via ozone) and city elevation.

## Scope

**In:**
- New `lib/uv-model.ts`: `ozoneDU`, `uvIndex`, `minElevationForUVI`, `synthesisThresholdElevation`.
- `lib/vitd.ts`: `estimateUVFromElevation` delegates to the new model; `MIN_UVI_ELEVATION`
  becomes the sea-level/300 DU *reference* threshold (≈33.7°) with an honest comment;
  `computeExposureFromCurve` accepts ozone and elevation.
- `lib/types.ts` + `lib/cities.ts`: a new `elevation` field (metres) on `City`, populated
  for the 73 builtin cities from sourced data.
- `components/GlobalHeatmap.tsx`, `components/WorldMap.tsx`, `components/DailyCurve.tsx`:
  use the per-day threshold rather than the constant.
- Tests: unit tests for the model, and **regression tests against the literature anchors**.
  `lib/vitd.ts` currently has **zero tests**; this is the first coverage it has ever had.

**Out:**
- Clouds, aerosols, real-time ozone, albedo/snow. Documented as known limitations.
- The Allaart/TEMIS engine (valid to SZA 90° but empirically too pessimistic here when
  combined with van Heuklon).
- The vitamin-D action spectrum debate (CIE 174:2006's extrapolated 315–330 nm shoulder).
  We keep the erythemal UVI ≥ 3 gate, which is conservative in winter.
- Any change to the city pages themselves. That is `feat/city-pages`, which merges this.

## Accuracy, stated honestly

The chosen model reproduces the three strongest anchors exactly. It is **±1–2 months at
the shoulders** elsewhere: it gives Crete (35.3°N) two impossible months where O'Neill
(2016) reports none, and removes June from Sydney where Cancer Council Australia reports
UV ≥ 3 year-round. The threshold elevation carries **±5–10° of uncertainty from ozone
alone**, which translates to roughly ±2–4 weeks at each shoulder.

Tests therefore assert the **measured** anchors exactly and give the **modeled** ones a
tolerance band. No test may be weakened to make the model pass; if an anchor fails, the
model is wrong.

## Consequences the user has accepted

- The dashboard's recommended minutes will **increase ~10–15%** (the old model
  overestimated summer UVI in Madrid at 11.3 vs a realistic ~9.8). The app has been
  telling people to sun less than they need.
- The heatmap and world map will show a shorter synthesis season. This is the correction,
  not a regression.
- 40 of 73 city pages will show the supplement block, versus 22 under the old model.

## Verification

- `lib/__tests__/uv-model.test.ts` — ozone table values at known (lat, doy); `uvIndex`
  known points; threshold inversion at 250/300/350/400 DU; altitude gain; monotonicity;
  zero below the horizon.
- `lib/__tests__/uv-literature.test.ts` — the regression gate:
  Boston (42.36°N) impossible months == exactly Nov, Dec, Jan, Feb (measured);
  Edmonton (53.55°N) == exactly Oct–Mar (measured);
  London (51.51°N) == exactly Oct–Mar (SACN);
  Miami and Singapore have zero impossible months;
  Reykjavík has ≥ 6 impossible months;
  Melbourne has a southern winter; Singapore's band never wraps.
- `npm test` green; `npm run build` green.
