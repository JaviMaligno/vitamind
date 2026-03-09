/**
 * Creates the cities table in Supabase using the Management API.
 * Run: set -a && source .env.local && set +a && npx tsx scripts/setup-cities-table.ts
 */

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").split(".")[0];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_REF || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const SQL = `
CREATE TABLE IF NOT EXISTS cities (
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

CREATE INDEX IF NOT EXISTS idx_cities_name_trgm ON cities USING gin (ascii_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cities_lat_lon ON cities (lat, lon);
CREATE INDEX IF NOT EXISTS idx_cities_population ON cities (population DESC);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cities' AND policyname = 'Cities are viewable by everyone') THEN
    CREATE POLICY "Cities are viewable by everyone" ON cities FOR SELECT USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION search_cities_nearby(p_lat REAL, p_lon REAL, p_limit INTEGER DEFAULT 5)
RETURNS SETOF cities AS $$
  SELECT * FROM cities
  ORDER BY (lat - p_lat) * (lat - p_lat) + (lon - p_lon) * (lon - p_lon)
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
`;

async function main() {
  // Use Supabase Management API to execute SQL
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/`;

  // Try using the pg_net or direct SQL approach via PostgREST
  // Actually, we need to use the Supabase SQL API
  // The Management API endpoint for SQL is:
  const mgmtUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log("Executing SQL against Supabase...");
  console.log("Project:", PROJECT_REF);

  const res = await fetch(mgmtUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed (${res.status}):`, text);

    // If management API doesn't work, try alternative approach
    if (res.status === 401 || res.status === 403) {
      console.log("\nThe Management API requires a personal access token, not a service role key.");
      console.log("Alternative: Please paste the SQL from docs/supabase-schema.sql into the Supabase SQL Editor:");
      console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    }
    process.exit(1);
  }

  const result = await res.json();
  console.log("Success!", JSON.stringify(result, null, 2));
}

main().catch(console.error);
