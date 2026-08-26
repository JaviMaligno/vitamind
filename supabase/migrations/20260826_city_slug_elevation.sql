-- Migration: stable slug + elevation on `cities`, and the RPCs the on-demand
-- city pages resolve through.
--
-- WHY THE SLUG IS A COLUMN AND NOT A DERIVATION. It is assigned ONCE, at seed
-- time, and never recomputed: first one in keeps the short `name-cc` form, the
-- rest get `-{geonameid}`. Stability is then a property of the database, not of
-- a derivation that depends on population order — which GeoNames does revise.
-- Recomputing per request would move URLs that are already published.
--
-- WHY ELEVATION IS BLOCKING (D-14). `lib/city-content.ts` defaults to
-- elevationM = 0, i.e. sea level for every non-curated city. Measured with the
-- repo's own model (UVI_ALTITUDE_GAIN_PER_KM = 0.08): of the 73 builtin cities,
-- FIVE change their month count just by zeroing their elevation (Edinburgh 5->6
-- at 47 m, Moscow 5->6 at 150 m, Phoenix 11->12, Sydney 11->12, Vancouver 6->7);
-- at 1500 m, 25 of 73 change. Publishing Bogota (2640 m), Cusco (3399 m), Mexico
-- City or Denver at sea level would print a wrong headline.
--
-- APPLY THIS BY HAND, IN ONE GO, BEFORE MERGING (see CLAUDE.md, "Supabase
-- migrations"): the deploy on merge is automatic, so the DB must be ready first.
--
-- HOW TO APPLY. Paste the WHOLE file into the Supabase SQL editor and run it
-- once. Two reasons it must be one paste and not statement by statement:
--   * Section 4 drops and recreates the two search RPCs (Postgres cannot change
--     a function's return type with CREATE OR REPLACE). Between the DROP and the
--     CREATE, /api/cities degrades to its non-localized fallback.
--   * Postgres runs a multi-statement script sent as ONE query in a single
--     implicit transaction, so a single paste makes that window atomic: either
--     every function exists in its new shape or none of them changed. Do NOT add
--     your own BEGIN/COMMIT — that is what would break the implicit transaction
--     into pieces and reopen the window.
--
-- SAFE TO RUN TWICE. Every statement here is idempotent: the columns and the
-- index use IF NOT EXISTS, the two new functions use CREATE OR REPLACE, and the
-- two recreated ones are dropped with IF EXISTS first. Re-running writes no row
-- data, so an already-seeded `slug` or `elevation` survives a second run
-- untouched.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH, ON PURPOSE. It adds two columns and never
-- reads, rewrites or drops any column the city search already depends on
-- (`geoname_id`, `name`, `ascii_name`, `country_code`, `lat`, `lon`,
-- `population`, `timezone`). `city_names` is not modified either. The production
-- search keeps working through the whole application.

-- 1. The two new columns. `elevation` is nullable on purpose: GeoNames uses
--    -9999 in the `dem` column for "no data", and a null that the code can fall
--    back from is honest where a 0 would be a claim about sea level.
ALTER TABLE cities ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS elevation SMALLINT;

-- UNIQUE, not just indexed: the tiebreak rule is only meaningful if the database
-- refuses a duplicate. A partial index skips the rows not yet seeded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_slug ON cities (slug) WHERE slug IS NOT NULL;

-- 2. Resolution by slug. One indexed lookup, plus the localized display name via
--    the same LEFT JOIN pattern `search_cities_localized` already uses.
--    country_code is CHAR(2) in the table and TEXT here, so it is cast
--    explicitly rather than relying on an implicit coercion.
CREATE OR REPLACE FUNCTION city_by_slug(p_slug TEXT, p_locale TEXT DEFAULT 'en')
RETURNS TABLE (
  geoname_id INTEGER,
  name TEXT,
  ascii_name TEXT,
  country_code TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  timezone TEXT,
  elevation SMALLINT,
  slug TEXT,
  display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.slug = p_slug
  LIMIT 1;
$$;

-- 3. Resolution by geoname id — the `/{prefix}/id-{geonameid}` alias, which the
--    route answers with a 301 to the canonical slug. It exists for the client
--    that only holds the id: the local fallback in lib/geonames.ts and the MCP
--    tools, neither of which knows the slug map.
CREATE OR REPLACE FUNCTION city_by_geoname_id(p_geoname_id INTEGER, p_locale TEXT DEFAULT 'en')
RETURNS TABLE (
  geoname_id INTEGER,
  name TEXT,
  ascii_name TEXT,
  country_code TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  timezone TEXT,
  elevation SMALLINT,
  slug TEXT,
  display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.geoname_id = p_geoname_id
  LIMIT 1;
$$;

-- 4. The two search RPCs gain `slug` and `elevation`. Postgres cannot change a
--    function's return type with CREATE OR REPLACE, so each is dropped first.
--    Between the DROP and the CREATE, /api/cities degrades to its non-localized
--    fallback — which is why this file is applied in a single execution.
DROP FUNCTION IF EXISTS search_cities_localized(TEXT, TEXT, INTEGER);

CREATE FUNCTION search_cities_localized(
  p_query TEXT,
  p_locale TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  geoname_id INTEGER, name TEXT, ascii_name TEXT, country_code TEXT,
  lat REAL, lon REAL, population INTEGER, timezone TEXT,
  elevation SMALLINT, slug TEXT, display_name TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  WHERE c.ascii_name ILIKE ('%' || p_query || '%')
     OR cn.name ILIKE ('%' || p_query || '%')
  ORDER BY c.population DESC
  LIMIT p_limit;
$$;

DROP FUNCTION IF EXISTS search_cities_nearby_localized(REAL, REAL, TEXT, INTEGER);

CREATE FUNCTION search_cities_nearby_localized(
  p_lat REAL,
  p_lon REAL,
  p_locale TEXT DEFAULT 'en',
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  geoname_id INTEGER, name TEXT, ascii_name TEXT, country_code TEXT,
  lat REAL, lon REAL, population INTEGER, timezone TEXT,
  elevation SMALLINT, slug TEXT, display_name TEXT, distance REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code::TEXT,
    c.lat, c.lon, c.population, c.timezone, c.elevation, c.slug,
    COALESCE(cn.name, c.name) AS display_name,
    sqrt(power(c.lat - p_lat, 2) + power(c.lon - p_lon, 2)) AS distance
  FROM cities c
  LEFT JOIN city_names cn ON c.geoname_id = cn.geoname_id AND cn.locale = p_locale
  ORDER BY distance
  LIMIT p_limit;
$$;

-- The `distance` above stays euclidean-in-degrees. That is NOT an oversight: it
-- is out of scope per spec §2, because fixing it does not merely relabel a
-- number — it changes which cities are returned for Nordic, Canadian and Russian
-- users, and that belongs in a PR of its own. Copied verbatim from
-- 20260320_city_names.sql.

-- 5. PostgREST caches the schema, and it is what serves .rpc() from the app.
--    Supabase normally reloads it on DDL through an event trigger; this NOTIFY
--    just makes it immediate and is harmless if the reload already happened.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFY (optional, read-only — paste separately AFTER the run above):
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'cities' AND column_name IN ('slug', 'elevation');
--   -- expect 2 rows: slug/text/YES and elevation/smallint/YES
--
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'cities' AND indexname = 'idx_cities_slug';
--   -- expect 1 row
--
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('city_by_slug', 'city_by_geoname_id',
--                      'search_cities_localized', 'search_cities_nearby_localized')
--    ORDER BY proname;
--   -- expect 4 rows
--
--   SELECT * FROM search_cities_localized('madrid', 'es', 1);
--   -- expect one row whose columns now include slug and elevation (both NULL
--   --   until the re-seed of Paso 14 fills them — NULL here is correct, not a
--   --   failure)
-- ---------------------------------------------------------------------------
