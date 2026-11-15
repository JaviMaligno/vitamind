# Ops alerts

**What it is:** upstream failures the app survives get written to `ops_events`;
an hourly GitHub Actions job asks production whether any threshold was crossed
and, if so, opens an issue labelled `ops-alert` that @mentions the owner and
fails the run. When things recover it comments and closes the issue.

**Why it exists:** on Hobby, Vercel keeps runtime logs for **one hour** and has
no alerts, anomaly detection or drains (all Pro). On 2026-09-22 the preview
spent ~10 minutes answering 502 because Open-Meteo refused its requests; the
only trace was a log line that expired before anyone read it.

```
/api/weather, MCP get_current_status
   └─ Open-Meteo fails ──► reportOpsEvent (after the response) ──► ops_events
                                                                      │
.github/workflows/ops-alerts.yml (hourly, :17) ──► GET /api/ops/alerts ┘
   └─ alerts? ──► issue `ops-alert` (+ @owner) + failed run ──► email
   └─ none, issue open? ──► "recovered" comment + close
```

## What is recorded

| source | kind | when |
|---|---|---|
| `weather`, `mcp-weather` | `upstream_error` | Open-Meteo answered non-2xx (status kept) or the call threw |
| `weather`, `mcp-weather` | `upstream_timeout` | the call timed out |
| `weather-radiation`, `mcp-weather-radiation` | `fallback` | the five-model irradiance request failed, so the forecast used Open-Meteo's own UV (docs/cloud-forecast.md) |
| `ops-alerts` | `heartbeat` | every poll — see below |

Never recorded: coordinates (only the upstream's host is kept, and numbers that
look like coordinates are scrubbed from the upstream's error text), IPs, user
agents, identifiers. `env` is `VERCEL_ENV`; alerts only count `production`.

**"Hourly" is what we ask for, not what GitHub delivers.** Scheduled workflows
are best-effort; the first 23 runs (2026-09-22 → 09-26) landed every 3-6 hours.
The check only sees the last hour, so a burst between runs goes unreported, and
an open issue stays open until the next run happens to land. Trigger a run by
hand (`gh workflow run ops-alerts.yml`) to re-check or close it sooner.

## Thresholds (last hour, production)

In `lib/ops-events.ts`, `ALERT_THRESHOLDS`:

- **critical** — `upstream_error + upstream_timeout ≥ 3`: readers got an error
  instead of a forecast.
- **warning** — `fallback ≥ 10`: forecasts went out without the median.

Tuned for current traffic, which is low. Revisit if they fire on noise.

## The monitoring watches itself

A store that fails quietly already hid two ~50-day outages in this repo
(`lib/push-store.ts`). So each poll **writes a heartbeat row and reads it
back**; if either fails, `/api/ops/alerts` answers 500 and the workflow raises
"the ops check itself failed". So does a missing `OPS_ALERT_TOKEN`. Blind
monitoring alerts; it never looks like a quiet hour.

## Setup (once)

1. Apply `supabase/migrations/20260922_ops_events.sql` (`supabase db push`)
   **before** the code that writes to it is deployed.
2. One random token in two places — Vercel **production** env `OPS_ALERT_TOKEN`
   (with `printf`, not `echo`: see CLAUDE.md) and the GitHub Actions secret of
   the same name.
3. Run the workflow once by hand (`gh workflow run ops-alerts.yml`) and check
   it goes green.

## Reading the history

The table keeps everything, unlike Vercel's logs:

```sql
select date_trunc('hour', occurred_at) as hour, source, kind, status, count(*)
from ops_events
where env = 'production' and kind <> 'heartbeat'
group by 1, 2, 3, 4
order by 1 desc;
```

## Incident #88 — Explore requested December forecasts in November

On **2026-11-14, 16:43:04–16:43:27 UTC**, production recorded 18 main
weather errors and 18 irradiance fallbacks. These were two failed upstream
calls per request, **18 failed weather requests**, not 36 visitors. Open-Meteo
returned HTTP 400: `start_date` was outside its allowed range, which ended on
2026-11-29. The issue opened at 17:05 and recovered automatically at 21:28.

Investigation on 2026-11-15 recovered all **18 HTTP 502 request records** from
Vercel, matching the persistent events. All carried `/en/explore` as their
referrer and dates between **2026-12-01 and 2026-12-30**. They reported the same
iPhone/Safari user-agent and a US Google Fiber network; Vercel supplied no
verified bot identity. This establishes the recorded request path and client
metadata, **not a person's identity or proof of a real device**. Headers can be
spoofed. No coordinates, IPs or client identifiers are copied into this report.

The code explains how ordinary exploration can trigger this: the date picker
and animation span the entire year, and `useWeather` requested the selected
day without checking the weather horizon. The API checked only date format.
Both upstream calls then failed for unsupported future days. MCP weather calls
were not the source (`weather`, not `mcp-weather`; no matching weather tool
events). Nearby analytics visits alone cannot identify who made the requests.

The fix shares the provider's **16-day horizon including today, in UTC**
between the API and `useWeather`. Explore uses its existing clear-sky model
outside that horizon without fetching weather. The API rejects unsupported or
invalid dates and incomplete/reversed ranges with 400 before making either
upstream call or recording an ops incident. Valid historical dates remain
eligible for the existing archive path. Regression tests cover both guards,
the inclusive boundary, leap days, year rollover, cache and in-flight changes.

**Check retention rather than assuming yesterday's logs are gone.** The older
one-hour note above motivated the incident store, but this investigation could
read both request metadata and weather error messages roughly 21 hours later.
Use `vercel logs --project vitamind --environment production --level error
--since <start> --until <end> --json`; request details also contain selected
dates, referrer and reported user-agent. Always scope by production and time,
and keep raw request details out of the repository.
