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
