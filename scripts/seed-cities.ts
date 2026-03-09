/**
 * Seed the Supabase `cities` table with GeoNames cities500 data.
 *
 * Usage:  npx tsx scripts/seed-cities.ts
 *
 * Requires env vars:
 *   SUPABASE_URL  (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import AdmZip from "adm-zip";

const GEONAMES_URL = "http://download.geonames.org/export/dump/cities500.zip";
const BATCH_SIZE = 1000;

interface CityRow {
  geoname_id: number;
  name: string;
  ascii_name: string;
  country_code: string;
  lat: number;
  lon: number;
  population: number;
  timezone: string;
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
  //    GeoNames cols: 0=geonameid, 1=name, 2=asciiname, 4=lat, 5=lon,
  //                   8=country_code, 14=population, 17=timezone
  const lines = text.split("\n").filter((l) => l.trim());
  console.log(`Parsed ${lines.length} cities`);

  const rows: CityRow[] = [];
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
    });
  }

  console.log(`Inserting ${rows.length} cities in batches of ${BATCH_SIZE} …`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("cities").upsert(batch, {
      onConflict: "geoname_id",
    });
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE} error:`, error.message);
    } else {
      inserted += batch.length;
    }
    if ((i / BATCH_SIZE) % 20 === 0) {
      console.log(`  … ${inserted} / ${rows.length}`);
    }
  }

  console.log(`Done. Inserted/updated ${inserted} cities.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
