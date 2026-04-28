create table push_subscriptions (
  id serial primary key,
  endpoint text unique not null,
  subscription jsonb not null,
  lat real not null default 0,
  lon real not null default 0,
  tz smallint not null default 0,
  skin_type smallint not null default 3,
  area_fraction real not null default 0.25,
  threshold smallint not null default 50,
  city_name text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- No RLS needed — push subscriptions are anonymous (no auth required)
-- The notify cron uses service_role key to read all subscriptions
alter table push_subscriptions enable row level security;

-- Anyone can insert/update their own subscription (matched by endpoint)
create policy "Anyone can subscribe"
  on push_subscriptions for insert with check (true);

create policy "Anyone can update own subscription"
  on push_subscriptions for update using (true);

create policy "Anyone can delete own subscription"
  on push_subscriptions for delete using (true);

-- Only service_role can read all (for cron notifications)
-- anon role cannot list all subscriptions
