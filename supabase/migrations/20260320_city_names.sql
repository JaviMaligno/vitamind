-- Migration: city_names table and localized search RPCs
-- Adds multilingual city name support via GeoNames alternate names

-- 1. city_names table for multilingual city names
CREATE TABLE IF NOT EXISTS city_names (
  geoname_id INTEGER NOT NULL REFERENCES cities(geoname_id) ON DELETE CASCADE,
  locale VARCHAR(3) NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (geoname_id, locale)
);

CREATE INDEX idx_city_names_locale ON city_names(locale);
CREATE INDEX idx_city_names_name_trgm ON city_names USING gin (name gin_trgm_ops);

-- 2. Localized name search RPC
CREATE OR REPLACE FUNCTION search_cities_localized(
  p_query TEXT,
  p_locale TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  geoname_id INTEGER,
  name TEXT,
  ascii_name TEXT,
  country_code TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  timezone TEXT,
  display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code,
    c.lat, c.lon, c.population, c.timezone,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.ascii_name ILIKE ('%' || p_query || '%')
     OR cn.name ILIKE ('%' || p_query || '%')
  ORDER BY c.population DESC
  LIMIT p_limit;
$$;

-- 3. Localized proximity search RPC
CREATE OR REPLACE FUNCTION search_cities_nearby_localized(
  p_lat REAL,
  p_lon REAL,
  p_locale TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  geoname_id INTEGER,
  name TEXT,
  ascii_name TEXT,
  country_code TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  timezone TEXT,
  display_name TEXT,
  distance REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code,
    c.lat, c.lon, c.population, c.timezone,
    COALESCE(cn.name, c.name) AS display_name,
    sqrt(power(c.lat - p_lat, 2) + power(c.lon - p_lon, 2)) AS distance
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  ORDER BY distance
  LIMIT p_limit;
$$;
