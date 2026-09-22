-- Operational incidents: upstream failures the app survives but somebody should
-- hear about.
--
-- Why a table: on Hobby, Vercel keeps runtime logs for ONE HOUR and has no
-- alerts or drains. On 2026-09-22 the preview spent ~10 minutes answering 502
-- because Open-Meteo refused its requests, and the only trace was a log line
-- that expired before anyone could read it. docs/ops-alerts.md.
--
-- Written by the server only (service role); read by /api/ops/alerts, which the
-- hourly GitHub Actions job polls. No user data: no IP, no coordinates, no
-- identifiers — `detail` is at most 200 characters of the UPSTREAM's own error.

create table if not exists public.ops_events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),

  -- VERCEL_ENV of the deployment that wrote the row: 'production', 'preview' or
  -- 'development'. Production and the dev preview share this project, and an
  -- alert must never fire because a preview was being tested.
  env         text not null,

  -- What was being done ('weather', 'weather-radiation', 'mcp-weather') and what
  -- happened ('upstream_error', 'upstream_timeout', 'fallback', 'heartbeat').
  source      text not null,
  kind        text not null,

  upstream    text,      -- hostname, e.g. api.open-meteo.com
  status      integer,   -- upstream HTTP status, when there was one
  detail      text       -- upstream error text or exception name, <= 200 chars
);

create index if not exists ops_events_env_occurred_at_idx
  on public.ops_events (env, occurred_at desc);

-- Service role only: RLS on with no policies, as `analytics_events`.
alter table public.ops_events enable row level security;

comment on table public.ops_events is
  'Upstream incidents the app survived (docs/ops-alerts.md). Service role only.';
