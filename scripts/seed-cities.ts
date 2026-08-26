/**
 * Seed the Supabase `cities` table with GeoNames cities500 data.
 *
 * Usage:  npx tsx scripts/seed-cities.ts [--dry-run]
 *
 * Requires env vars:
 *   SUPABASE_URL  (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Requires `supabase/migrations/20260826_city_slug_elevation.sql` to have been
 * applied first: this script writes `cities.slug` and `cities.elevation`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AdmZip from "adm-zip";

import { dynamicCitySlug } from "../lib/city-dynamic-slug";

const GEONAMES_URL = "http://download.geonames.org/export/dump/cities500.zip";
const BATCH_SIZE = 1000;

export interface SeedRow {
  geoname_id: number;
  name: string;
  ascii_name: string;
  country_code: string;
  lat: number;
  lon: number;
  population: number;
  timezone: string;
  elevation: number | null;
  /** Assigned by `assignSlugs`. Optional because a freshly parsed row has none. */
  slug?: string;
}

/** SMALLINT, the column type in the migration. */
const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;

/**
 * GeoNames column 16 (`dem`) → metres, or null.
 *
 * COLUMN 16, NOT 15. Column 15 (`elevation`) is populated for a small minority
 * of rows; `dem` (digital elevation model) is filled for essentially all of
 * them, which is why it is the one worth storing.
 *
 * `-9999` is the dump's "no data" marker, not a place 10 km under the sea.
 * Storing it would hand `UVI_ALTITUDE_GAIN_PER_KM` (0.08 per km, lib/uv-model)
 * a number that is wrong by three orders of magnitude. null and 0 are not
 * interchangeable either: null means "unknown", 0 asserts sea level.
 */
export function parseElevation(raw: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const metres = Math.round(n);
  if (metres === -9999) return null;
  if (metres < SMALLINT_MIN || metres > SMALLINT_MAX) return null;
  return metres;
}

/**
 * Give every row its permanent slug.
 *
 * THE SLUG IS ASSIGNED ONCE AND NEVER RECOMPUTED. A row that already carries
 * one (because the database already holds it — see `loadExistingSlugs`) keeps
 * it untouched: its URL may already be published, and a slug that moves is a
 * 404 on a page that had accumulated whatever little authority it had.
 *
 * For the rest: the short `name-cc` form goes to the most populated member of a
 * colliding group, the others get `name-cc-{geonameid}`. Ties in population are
 * broken by geoname id, so the outcome does not depend on the order of lines in
 * the GeoNames dump — a re-run over a reshuffled file assigns the same slugs.
 *
 * `taken` is mutated as we go: two rows of the same batch would otherwise
 * collide with each other, not just with what the database already has.
 *
 * Rows come back in their ORIGINAL order (the sort runs over a copy of the
 * indices), because the caller batches them against the parsed dump.
 */
export function assignSlugs(rows: SeedRow[], taken: Set<string>): SeedRow[] {
  const order = rows.map((_, i) => i);
  order.sort(
    (a, b) =>
      rows[b].population - rows[a].population ||
      rows[a].geoname_id - rows[b].geoname_id
  );

  const slugs: string[] = new Array(rows.length);
  for (const i of order) {
    const r = rows[i];
    if (r.slug) {
      taken.add(r.slug);
      slugs[i] = r.slug;
      continue;
    }
    const base = dynamicCitySlug(r.ascii_name, r.country_code);
    const slug = taken.has(base)
      ? dynamicCitySlug(r.ascii_name, r.country_code, r.geoname_id)
      : base;
    taken.add(slug);
    slugs[i] = slug;
  }

  return rows.map((r, i) => ({ ...r, slug: slugs[i] }));
}

/**
 * Every slug the table already holds: the set to avoid colliding with, and the
 * geoname_id → slug map that pins those rows to the slug they were published
 * under. Paged, because the table has ~230k rows and PostgREST caps a response.
 */
async function loadExistingSlugs(
  supabase: SupabaseClient
): Promise<{ taken: Set<string>; existing: Map<number, string> }> {
  const taken = new Set<string>();
  const existing = new Map<number, string>();
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("cities")
      .select("geoname_id, slug")
      .not("slug", "is", null)
      .range(from, from + BATCH_SIZE - 1);
    if (error) throw new Error(`reading existing slugs: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { geoname_id: number; slug: string }[]) {
      taken.add(r.slug);
      existing.set(r.geoname_id, r.slug);
    }
    if (data.length < BATCH_SIZE) break;
  }
  return { taken, existing };
}

function parseDump(text: string): SeedRow[] {
  // GeoNames cols: 0=geonameid, 1=name, 2=asciiname, 4=lat, 5=lon,
  //                8=country_code, 14=population, 16=dem, 17=timezone
  const lines = text.split("\n").filter((l) => l.trim());
  console.log(`Parsed ${lines.length} cities`);

  const rows: SeedRow[] = [];
  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 18) continue;
    rows.push({
      geoname_id: parseInt(cols[0], 10),
      name: cols[1],
      ascii_name: cols[2],
      country_code: cols[8],
      lat: parseFloat(cols[4]),
      lon: parseFloat(cols[5]),
      population: parseInt(cols[14], 10) || 0,
      timezone: cols[17],
      elevation: parseElevation(cols[16]),
    });
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing env vars. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Download cities500.zip
  console.log("Downloading cities500.zip …");
  const res = await fetch(GEONAMES_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // 2. Unzip and find cities500.txt
  console.log("Unzipping …");
  const zip = new AdmZip(buf);
  const entry = zip.getEntries().find((e) => e.entryName === "cities500.txt");
  if (!entry) throw new Error("cities500.txt not found in archive");
  const text = entry.getData().toString("utf-8");

  // 3. Parse tab-separated rows
  const parsed = parseDump(text);

  // 4. Slugs: read what the table already published, keep every one of them.
  const { taken, existing } = await loadExistingSlugs(supabase);
  console.log(`existing slugs preserved: ${taken.size}`);

  const seeded = assignSlugs(
    parsed.map((r) => {
      const kept = existing.get(r.geoname_id);
      return kept ? { ...r, slug: kept } : r;
    }),
    taken
  );

  const preserved = seeded.filter(
    (r) => existing.get(r.geoname_id) === r.slug
  ).length;
  const noElevation = seeded.filter((r) => r.elevation === null).length;
  console.log(
    `rows: ${seeded.length}  new slugs: ${seeded.length - preserved}  ` +
      `preserved: ${preserved}  null elevation: ${noElevation}`
  );

  if (dryRun) {
    console.log("--dry-run: nothing written.");
    return;
  }

  // 5. Upsert column by column (Q-C(a)): the conflict target is geoname_id and
  //    the whole object is sent. `name`, `lat`, `lon`, `population` and
  //    `timezone` come from the same dump the table was built from, so there is
  //    nothing to lose by rewriting them; `slug` is the one value that is never
  //    overwritten, guaranteed upstream by `existing`.
  console.log(`Upserting ${seeded.length} cities in batches of ${BATCH_SIZE} …`);

  let inserted = 0;
  for (let i = 0; i < seeded.length; i += BATCH_SIZE) {
    const batch = seeded.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("cities").upsert(batch, {
      onConflict: "geoname_id",
    });
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE} error:`, error.message);
    } else {
      inserted += batch.length;
    }
    if ((i / BATCH_SIZE) % 20 === 0) {
      console.log(`  … ${inserted} / ${seeded.length}`);
    }
  }

  console.log(`Done. Inserted/updated ${inserted} cities.`);
}

/**
 * IMPORT SAFETY — run the seeder only when this file IS the entry point.
 *
 * `scripts/__tests__/seed-slug-assignment.test.ts` imports this module for its
 * pure functions, and `npm test` runs inside vercel.json's `buildCommand`,
 * where NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both set
 * (lib/push-store.ts, lib/oauth.ts and lib/mcp-personal.ts need them at
 * runtime). Without this guard, that import runs `main()`: a GeoNames download
 * followed by an upsert of 230,407 rows into the PRODUCTION `cities` table —
 * the table that serves the live search — on every production build.
 *
 * Checked against argv rather than `import.meta`, so it behaves the same
 * whether the file is loaded as ESM or transpiled to CJS. `npx tsx
 * scripts/seed-cities.ts` puts the script path in argv[1]; vitest puts its own
 * binary there.
 */
const invokedDirectly = (process.argv[1] ?? "")
  .replace(/\\/g, "/")
  .toLowerCase()
  .endsWith("scripts/seed-cities.ts");

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
