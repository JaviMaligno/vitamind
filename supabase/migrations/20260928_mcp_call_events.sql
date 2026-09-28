-- Persistent MCP tool usage. No args, results, client identifiers or tokens.
-- Separate from analytics_events: MCP calls do not have browser visitor IDs.
create table if not exists public.mcp_call_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null,
  tool text not null check (tool ~ '^[a-z][a-z0-9_]{0,63}$'),
  duration_ms integer not null check (duration_ms >= 0),
  outcome text not null check (outcome in (
    'success', 'tool_error', 'authentication_required', 'insufficient_scope', 'exception'
  )),
  env text not null check (env in ('production', 'preview', 'development'))
);

create index if not exists mcp_call_events_env_time_idx
  on public.mcp_call_events (env, occurred_at desc);

-- Service role writes/reads only; never expose the stream through browser auth.
alter table public.mcp_call_events enable row level security;
revoke all on public.mcp_call_events from anon, authenticated;
grant select, insert on public.mcp_call_events to service_role;
grant usage, select on sequence public.mcp_call_events_id_seq to service_role;
