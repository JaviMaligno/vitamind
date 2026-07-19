-- OAuth 2.1 authorization server state for the MCP personal tools.
-- All access is server-side via the service role; RLS is enabled with no
-- anon/authenticated policies, same posture as push_subscriptions.

create table if not exists oauth_clients (
  client_id uuid primary key default gen_random_uuid(),
  client_name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists oauth_codes (
  code_hash text primary key,
  client_id uuid not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  scope text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists oauth_tokens (
  token_hash text primary key,
  refresh_hash text unique,
  client_id uuid not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists oauth_tokens_user_idx on oauth_tokens(user_id);
create index if not exists oauth_tokens_refresh_idx on oauth_tokens(refresh_hash);

alter table oauth_clients enable row level security;
alter table oauth_codes enable row level security;
alter table oauth_tokens enable row level security;
