-- Product analytics event stream.
--
-- Vercel Web Analytics keeps pageviews, but custom events are a Pro feature and
-- this project is on Hobby, so the funnel that matters — the acts a person takes
-- when the product asks them for no account — had nowhere to land. This table is
-- that destination.
--
-- Deliberately stores no IP, no user agent and no full referrer: first-party,
-- pseudonymous, and nothing here identifies a person. `authed` is a boolean
-- rather than a user id on purpose — the question is whether account holders
-- behave differently, which a flag answers without linking behaviour to an
-- identity.

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,

  -- Random UUID minted in the browser and kept in localStorage. Survives across
  -- sessions so "did this person come back on another day" is answerable, which
  -- is the whole retention question for a product with no accounts.
  visitor_id   uuid        not null,
  -- Random UUID per page load, so a burst of events can be read as one visit.
  session_id   uuid        not null,

  name         text        not null,
  props        jsonb       not null default '{}'::jsonb,

  path         text,
  locale       text,
  -- Host only ("news.ycombinator.com"), never the full URL: query strings on
  -- referrers routinely carry identifiers we have no reason to keep.
  referrer_host text,
  authed       boolean     not null default false,

  -- When the event happened in the browser (clamped server-side to a sane
  -- window), not when the batch arrived — events are sent in batches on page
  -- hide, so arrival order is not event order.
  occurred_at  timestamptz not null,
  created_at   timestamptz not null default now()
);

-- "What happened lately", the default shape of every question asked here.
create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);

-- Funnel/counting queries filter by name first.
create index if not exists analytics_events_name_occurred_at_idx
  on public.analytics_events (name, occurred_at desc);

-- Retention and per-person paths: group a visitor's events across sessions.
create index if not exists analytics_events_visitor_idx
  on public.analytics_events (visitor_id, occurred_at);

-- Service-role only, matching 20260716_lock_down_anon_access.sql: RLS on with
-- NO policies, so the anon key (which ships to every browser) can neither read
-- the stream nor write to it. Ingestion goes through /api/events, which holds
-- the service role key. Do not add a `using (true)` policy to "make it work".
alter table public.analytics_events enable row level security;
