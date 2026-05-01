-- Supabase schema for VitaminD profiles
-- Run this in the Supabase SQL editor after creating a project

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  skin_type smallint default 3 check (skin_type between 1 and 6),
  area_fraction real default 0.25,
  age smallint check (age is null or (age between 1 and 120)),
  threshold smallint default 50,
  favorites jsonb default '[]'::jsonb,
  custom_locations jsonb default '[]'::jsonb,
  last_city_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Users can only read/write their own profile
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
