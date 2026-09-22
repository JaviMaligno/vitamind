# Where the forecast cloud comes from

**Since 2026-09-22 a forecast's cloud is the median of five models' forecast
irradiance, not Open-Meteo's `uv_index`.** `lib/cloud-transmission.ts` does it;
`app/api/weather/route.ts` (forecasts only) and `get_current_status` in the MCP
server use it. The clear-sky UV is still Open-Meteo's `uv_index_clear_sky`; only
the fraction of it that the cloud lets through changed.

```
uvIndex = uv_index_clear_sky × min(1, median(GHI of 5 models) / GHI_clear-sky)
```

Models: `ukmo_seamless`, `meteofrance_seamless`, `ecmwf_ifs025`, `icon_seamless`,
`gfs_seamless`. At least three must answer for an hour; below that, or with the
clear-sky irradiance under 50 W/m², or if the second request fails at all, the
hour keeps Open-Meteo's own `uv_index` — i.e. exactly the previous behaviour.

## The report that started it

London, 2026-09-22, clear sky; the dashboard said no window. Open-Meteo's
`best_match` is the Met Office model in the UK, and every run that day — 00, 06,
09 and 12 UTC — forecast 43-96% cloud over the window, peak UV 2.75. Heathrow's
METARs showed no significant cloud (at most SCT/FEW); the satellite measured
511 W/m² at 13:00 against that model's 429. The Met Office's own global model
said 0% cloud.

Replayed with the median of five: UV ≥ 3 from 12:00 to 15:00 (same-day run),
13:00-14:00 on the day-ahead run. `lib/__tests__/cloud-transmission.test.ts`
pins that day with the real payloads.

## The evidence

All day-ahead forecasts (`*_previous_day1` on the previous-runs host), hours with
the sun above 25°, error measured on the clear-sky index `GHI / GHI_clear`
(Haurwitz), hourly values read as the mean of the hour BEFORE their stamp
(see `FORECAST_STAMP_LAG_H` in `lib/vitd.ts`).

### 1. Satellite, 73 cities × 2 years — useful for structure, biased for ranking

Open-Meteo's satellite archive as truth, Sep 2024 - Sep 2026, 491k hours.
Everything was chosen on the first year and scored on the second.

- ECMWF came out best in all 11 zones and all 4 seasons.
- Per-zone and per-zone-and-season choices or blends did **not** beat one global
  blend on the held-out year. There is no zone or season effect worth modelling.

But the satellite itself misses the ground by ~0.125 on this index, and it
flatters ECMWF (below). So this ranking is not used.

### 2. Ground stations — what the choice is based on

One year (Sep 2025 - Aug 2026). 10 DWD stations in Germany (10-minute global
radiation, open data) and 5 NOAA SURFRAD stations in the US (1-minute, every
other day).

| mean abs error, clear-sky index | Germany | USA |
|---|---|---|
| **median of the 5** | **0.123** | **0.119** |
| mean of the 5 | 0.123 | 0.121 |
| ECMWF | 0.134 | 0.131 |
| Météo-France | 0.142 | 0.137 |
| ICON | 0.143 | 0.130 |
| UKMO | 0.162 | 0.164 |
| GFS | 0.169 | 0.156 |
| **best_match (what was used)** | 0.144 | 0.156 |
| weights fitted on the OTHER continent | 0.126 | 0.121 |

Against the satellite, ECMWF scored 0.084/0.078 on the same hours — the bias
mentioned above.

Weights fitted by non-negative least squares came out nearly identical on both
continents (ECMWF ~0.33, ICON ~0.28, Météo-France ~0.15-0.20, UKMO ~0.10, GFS
~0.07-0.12) and did not beat the plain median across the Atlantic. Hence the
median: no parameters to go stale.

Day level, "at least one hour with the sun ≥ 35° and index ≥ 0.7", the failure
the report was about (forecast no sun, there was): median 3.3% of such days in
Germany, 1.6% in the US; best_match 6.7% and 1.8%.

### 3. UV — measured UVB at the five SURFRAD stations

The UV that cloud lets through follows the irradiance ratio almost exactly:

| irradiance ratio | 0.15 | 0.40 | 0.60 | 0.78 | 0.90 |
|---|---|---|---|---|---|
| measured UV vs clear sky | ×0.25 | ×0.48 | ×0.68 | ×0.83 | ×0.93 |

Fitting `ratio^p` on two stations and testing on the other three gave p = 1.04,
so the ratio is used as is. On the three test stations:

| UV let through by cloud, vs measured | error | bias | sunny days invented |
|---|---|---|---|
| **median-5 irradiance ratio (day-ahead)** | **0.133** | **0.00** | **40%** |
| Open-Meteo `uv_index / uv_index_clear_sky` (short lead) | 0.154 | +0.04 | 66% |

Open-Meteo is handicapped in its favour there (its archived UV is short-lead;
the day-ahead field comes back null) and still loses. In exchange, sunny days
missed go from 1.0% to 2.9%.

**Side result:** measured clear-sky UVB scales as sin(elevation)^2.36-2.43. Our
Madronich exponent is 2.42. The U-shaped disagreement with Open-Meteo that sank
the ozone re-base (docs/ozone-rebase.md) is on their side, not ours.

## Limits

- Ground truth covers Germany and the US only, UV the US only. The tropics and
  the southern hemisphere rest on the satellite comparison, which flatters ECMWF.
- A station measures a point, a model an area; that inflates every error
  equally and does not change the order.
- Open-Meteo's free tier is non-commercial. The second request is five
  variables, under the 10-variable line, so it counts as one call: forecasts
  now cost two calls instead of one.
- History (`start`/`end` on `/api/weather`, `lib/history-window.ts`) is
  unchanged: it asks what happened, not what was forecast.
- `currentUVI` and `computeExposure` still read Open-Meteo's hourly stamps as
  instants (see `FORECAST_STAMP_LAG_H`); unchanged here.

## Reproducing

`scripts/cloud-backtest/` — Python, numpy and scipy; network only, writes its data
next to itself (gitignored). In order:

```bash
python fetch2.py            # 73 cities x 2 years, satellite + day-ahead forecasts  (~75 min)
python analyze2.py          # zones, seasons, blends, train/test
python surfrad.py           # 5 SURFRAD stations, GHI + UVB                          (~40 min)
python dwd.py               # 10 DWD stations (uses curl: Python's CA store rejects DWD)
python ground.py surfrad.json && python ground.py dwd.json
python cross.py             # blends fitted on one continent, scored on the other
python uv_check.py          # measured UVB vs the three UV methods
```
