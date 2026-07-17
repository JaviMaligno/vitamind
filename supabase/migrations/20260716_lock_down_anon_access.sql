-- Migration: remove anon access to push_subscriptions and enable RLS on city_names
--
-- Why: the original push_subscriptions policies were all `using (true)`, which
-- let anyone holding the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY, shipped
-- to every browser) read the full subscription table — including each
-- subscriber's endpoint, push crypto keys and lat/lon (a location-privacy leak)
-- — and UPDATE or DELETE every row.
--
-- None of those policies are needed: the browser never talks to the table
-- directly. All reads/writes go through /api/push/subscribe and
-- /api/push/notify, which use the service_role key (lib/push-store.ts), and
-- service_role bypasses RLS. The old comment "Anon needs SELECT for upsert to
-- work" predates that design and is wrong.
--
-- With RLS enabled and zero policies, anon/authenticated get no access while
-- the service-role server code keeps working unchanged.

drop policy if exists "Anyone can subscribe" on push_subscriptions;
drop policy if exists "Anyone can update own subscription" on push_subscriptions;
drop policy if exists "Anyone can delete own subscription" on push_subscriptions;
drop policy if exists "Anyone can read subscriptions" on push_subscriptions;

-- city_names was created without RLS. In Supabase, a public-schema table with
-- RLS disabled is readable AND writable by anon through PostgREST, so anyone
-- could tamper with localized city names. Reads happen via the
-- search_cities_*_localized RPCs (SECURITY INVOKER, LANGUAGE sql) — those RPCs
-- need SELECT, so keep a read-only policy; seeding uses the service role.
alter table city_names enable row level security;

create policy "city_names readable by everyone"
  on city_names for select using (true);
