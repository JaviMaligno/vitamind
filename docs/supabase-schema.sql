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

-- Cities table (GeoNames cities500)
CREATE TABLE cities (
  geoname_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ascii_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  population INTEGER DEFAULT 0,
  timezone TEXT NOT NULL
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cities_name_trgm ON cities USING gin (ascii_name gin_trgm_ops);
CREATE INDEX idx_cities_lat_lon ON cities (lat, lon);
CREATE INDEX idx_cities_population ON cities (population DESC);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities are viewable by everyone" ON cities FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION search_cities_nearby(p_lat REAL, p_lon REAL, p_limit INTEGER DEFAULT 5)
RETURNS SETOF cities AS $$
  SELECT * FROM cities
  ORDER BY (lat - p_lat) * (lat - p_lat) + (lon - p_lon) * (lon - p_lon)
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
