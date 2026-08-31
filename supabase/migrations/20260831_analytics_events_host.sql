-- Which deployment an event came from.
--
-- Production (getvitamind.app) and the dev preview (getvitamind-dev.vercel.app)
-- share this Supabase project, so without a marker a QA pass on dev is
-- indistinguishable from a real visitor — which is exactly the mistake
-- `push_subscriptions` already avoids by scoping rows on `vapid_public_key`.
--
-- Filled by /api/events from the request's Host header, never from the body:
-- the client has no business asserting which deployment it is talking to.
--
-- NULL on rows written before 2026-08-31, whose origin is genuinely unknown.

alter table analytics_events
  add column if not exists host text;

create index if not exists analytics_events_host_occurred_at_idx
  on analytics_events (host, occurred_at desc);

comment on column analytics_events.host is
  'Deployment the event was sent to, from the request Host header (getvitamind.app = production). NULL = written before the column existed.';
