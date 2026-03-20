/**
 * Seed the Supabase `city_names` table with GeoNames alternate names.
 *
 * Usage:  npx tsx scripts/seed-city-names.ts
 *
 * Requires env vars:
 *   SUPABASE_URL  (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Requires `unzipper` package:
 *   npm install -D unzipper @types/unzipper
 */

import { createClient } from "@supabase/supabase-js";
import { createWriteStream, createReadStream, existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createInterface } from "readline";
import { Open } from "unzipper";

const ALTERNATE_NAMES_URL =
  "https://download.geonames.org/export/dump/alternateNamesV2.zip";
const BATCH_SIZE = 1000;
const SUPPORTED_LOCALES = new Set(["es", "en", "fr", "de", "ru", "lt"]);

interface CityNameRow {
  geoname_id: number;
  locale: string;
  name: string;
}

async function fetchAllGeonameIds(
  supabase: ReturnType<typeof createClient>
): Promise<Set<number>> {
  const ids = new Set<number>();
  const PAGE_SIZE = 1000;
  let from = 0;

  console.log("Fetching geoname_ids from cities table …");

  while (true) {
    const { data, error } = await supabase
      .from("cities")
      .select("geoname_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch cities: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      ids.add(row.geoname_id);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`  Found ${ids.size} cities in database.`);
  return ids;
}

async function downloadZip(destPath: string): Promise<void> {
  if (existsSync(destPath)) {
    console.log("Zip already downloaded, skipping download.");
    return;
  }

  console.log("Downloading alternateNamesV2.zip (~250 MB) …");
  const res = await fetch(ALTERNATE_NAMES_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const fileStream = createWriteStream(destPath);
  // Convert web ReadableStream to Node stream for pipeline
  const { Readable } = await import("stream");
  const nodeStream = Readable.fromWeb(res.body as any);
  await pipeline(nodeStream, fileStream);

  console.log("Download complete.");
}

async function extractTxt(zipPath: string, txtPath: string): Promise<void> {
  if (existsSync(txtPath)) {
    console.log("Text file already extracted, skipping extraction.");
    return;
  }

  console.log("Extracting alternateNamesV2.txt from zip …");
  const directory = await Open.file(zipPath);
  const entry = directory.files.find(
    (f) => f.path === "alternateNamesV2.txt"
  );
  if (!entry) throw new Error("alternateNamesV2.txt not found in archive");

  const readStream = entry.stream();
  const writeStream = createWriteStream(txtPath);
  await pipeline(readStream, writeStream);

  console.log("Extraction complete.");
}

async function parseTxt(
  txtPath: string,
  cityIds: Set<number>
): Promise<CityNameRow[]> {
  console.log("Parsing alternateNamesV2.txt …");

  // Map of "geonameId:locale" -> { name, isPreferred }
  const best = new Map<string, { name: string; isPreferred: boolean }>();
  let linesRead = 0;

  const rl = createInterface({
    input: createReadStream(txtPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    linesRead++;
    if (linesRead % 5_000_000 === 0) {
      console.log(`  … read ${(linesRead / 1_000_000).toFixed(1)}M lines`);
    }

    const cols = line.split("\t");
    if (cols.length < 8) continue;

    const geonameId = parseInt(cols[1], 10);
    if (!cityIds.has(geonameId)) continue;

    const isoLanguage = cols[2];
    if (!SUPPORTED_LOCALES.has(isoLanguage)) continue;

    const isHistoric = cols[7] === "1";
    if (isHistoric) continue;

    const alternateName = cols[3];
    const isPreferred = cols[4] === "1";
    const key = `${geonameId}:${isoLanguage}`;

    const existing = best.get(key);
    if (!existing || (!existing.isPreferred && isPreferred)) {
      best.set(key, { name: alternateName, isPreferred });
    }
  }

  console.log(
    `  Parsed ${linesRead} lines, found ${best.size} matching name entries.`
  );

  const rows: CityNameRow[] = [];
  for (const [key, val] of best) {
    const [gidStr, locale] = key.split(":");
    rows.push({
      geoname_id: parseInt(gidStr, 10),
      locale,
      name: val.name,
    });
  }

  return rows;
}

async function upsertRows(
  supabase: ReturnType<typeof createClient>,
  rows: CityNameRow[]
): Promise<void> {
  console.log(
    `Upserting ${rows.length} city names in batches of ${BATCH_SIZE} …`
  );

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("city_names").upsert(batch, {
      onConflict: "geoname_id,locale",
    });
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE)} error:`, error.message);
    } else {
      inserted += batch.length;
    }
    if (Math.floor(i / BATCH_SIZE) % 20 === 0) {
      console.log(`  … ${inserted} / ${rows.length}`);
    }
  }

  console.log(`Done. Upserted ${inserted} city name rows.`);
}

function cleanup(zipPath: string, txtPath: string): void {
  console.log("Cleaning up temp files …");
  try {
    if (existsSync(txtPath)) unlinkSync(txtPath);
  } catch {
    console.warn(`Could not delete ${txtPath}`);
  }
  try {
    if (existsSync(zipPath)) unlinkSync(zipPath);
  } catch {
    console.warn(`Could not delete ${zipPath}`);
  }
}

async function main() {
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

  const zipPath = join(tmpdir(), "alternateNamesV2.zip");
  const txtPath = join(tmpdir(), "alternateNamesV2.txt");

  try {
    // 1. Fetch all city geoname_ids from Supabase
    const cityIds = await fetchAllGeonameIds(supabase);
    if (cityIds.size === 0) {
      console.log("No cities in database. Run seed-cities.ts first.");
      return;
    }

    // 2. Download zip to temp dir (skip if cached)
    await downloadZip(zipPath);

    // 3. Extract the txt from the zip (streaming, skip if cached)
    await extractTxt(zipPath, txtPath);

    // 4. Stream-parse the txt, filtering for our cities and locales
    const rows = await parseTxt(txtPath, cityIds);

    // 5. Batch upsert into Supabase
    await upsertRows(supabase, rows);
  } finally {
    // 6. Clean up temp files
    cleanup(zipPath, txtPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
