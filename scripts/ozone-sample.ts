/**
 * Collect clear-sky UV observations from Open-Meteo, for re-basing the ozone
 * climatology. See docs/ozone-rebase.md for the runbook and lib/ozone-fit.ts
 * for what is done with the output.
 *
 *   npx tsx scripts/ozone-sample.ts --from 2026-07-01 --to 2026-09-22
 *
 * Appends to `data/ozone-samples.json`, deduplicating on (city, hour), so it is
 * safe to run repeatedly as the year goes by — which it has to be, because the
 * forecast host only serves UV for a window around today (lib/weather-range.ts
 * puts it at about 92 days back; forward is roughly a fortnight). A full year
 * therefore takes several runs spread across it, or a source with a longer
 * archive. The script does not pretend otherwise: it reports the span it
 * actually received, per city.
 *
 * This is the ONLY part of the pipeline that needs the network, and it is
 * deliberately thin. Everything it feeds is pure and already tested in
 * lib/__tests__/ozone-fit.test.ts.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BUILTIN_CITIES } from "../lib/cities";
import { solarElev, dayOfYear } from "../lib/solar";
import { MIN_USEFUL_ELEVATION_DEG, type OzoneSample } from "../lib/ozone-fit";

const OUT_DEFAULT = "data/ozone-samples.json";
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
/** Open-Meteo asks for courtesy on the free tier; this is well inside it. */
const PAUSE_MS = 350;
const TIMEOUT_MS = 20_000;

interface StoredSample extends OzoneSample {
  /** Kept so a rerun can deduplicate and a human can audit a row. */
  city: string;
  time: string;
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined && fallback === undefined) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v ?? fallback!;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCity(city: (typeof BUILTIN_CITIES)[number], from: string, to: string) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", String(city.lat));
  url.searchParams.set("longitude", String(city.lon));
  url.searchParams.set("hourly", "uv_index_clear_sky");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const from = arg("from");
  const to = arg("to");
  const out = arg("out", OUT_DEFAULT);
  const limit = Number(arg("cities", String(BUILTIN_CITIES.length)));

  let existing: StoredSample[] = [];
  try {
    existing = JSON.parse(readFileSync(out, "utf8"));
    console.log(`[ozone] ${existing.length} samples already in ${out}`);
  } catch {
    console.log(`[ozone] starting a fresh ${out}`);
  }
  const seen = new Set(existing.map((s) => `${s.city}|${s.time}`));

  const added: StoredSample[] = [];
  const failures: string[] = [];

  for (const city of BUILTIN_CITIES.slice(0, limit)) {
    try {
      const data = await fetchCity(city, from, to);
      const times: string[] = data?.hourly?.time ?? [];
      const uvi: (number | null)[] = data?.hourly?.uv_index_clear_sky ?? [];
      // Local times come back with the zone's offset; the solar geometry needs UTC.
      const offsetH = (data?.utc_offset_seconds ?? 0) / 3600;
      let kept = 0;
      times.forEach((time, i) => {
        const v = uvi[i];
        if (typeof v !== "number" || v <= 0) return;
        const key = `${city.name}|${time}`;
        if (seen.has(key)) return;
        const local = new Date(`${time}:00Z`);
        const doy = dayOfYear(local);
        const localH = local.getUTCHours() + local.getUTCMinutes() / 60;
        const elevationDeg = solarElev(city.lat, city.lon, doy, localH - offsetH);
        // The fit discards these anyway; dropping them here keeps the file small.
        if (elevationDeg < MIN_USEFUL_ELEVATION_DEG) return;
        seen.add(key);
        added.push({
          city: city.name, time, lat: city.lat, doy,
          elevationDeg, elevationM: city.elevation ?? 0, uviClearSky: v,
        });
        kept += 1;
      });
      const span = times.length ? `${times[0]} .. ${times[times.length - 1]}` : "nothing";
      console.log(`[ozone] ${city.name.padEnd(18)} +${String(kept).padStart(4)}  (${span})`);
    } catch (err) {
      failures.push(`${city.name}: ${(err as Error).message}`);
      console.error(`[ozone] ${city.name.padEnd(18)} FAILED  ${(err as Error).message}`);
    }
    await sleep(PAUSE_MS);
  }

  const all = [...existing, ...added];
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(all, null, 0) + "\n");
  console.log(`\n[ozone] +${added.length} new, ${all.length} total -> ${out}`);
  if (failures.length) {
    console.error(`[ozone] ${failures.length} cities failed:`);
    for (const f of failures) console.error(`  ${f}`);
    // A partial sweep is usable — the fit leaves thin cells null — but the
    // operator has to know it happened rather than read a clean exit.
    process.exitCode = 1;
  }
}

main();
