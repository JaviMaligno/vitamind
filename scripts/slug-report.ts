/**
 * Offline dry-run of the dynamic city slug assignment.
 *
 * Usage:  npx tsx scripts/slug-report.ts
 *
 * Downloads the same GeoNames dump that `scripts/seed-cities.ts` uses
 * (cities500.zip), parses it the same way, and assigns every row the slug that
 * the seeding will assign — WITHOUT touching Supabase. It exists to answer one
 * question with data instead of a hunch: does the country-qualified slug scheme
 * (`name-cc`, `-geonameid` on collision) actually resolve collisions, and does
 * it stay disjoint from the 73 curated city pages in `lib/city-slugs.ts`?
 *
 * Algorithm (must stay byte-identical to the one in scripts/seed-cities.ts):
 *   1. Sort by population DESC, ties broken by geoname_id ASC. Deterministic and
 *      independent of the order of lines in the dump.
 *   2. candidate = slugify(ascii_name) + "-" + country_code.toLowerCase()
 *   3. If the candidate is already taken -> candidate + "-" + geoname_id
 *
 * Optional env:
 *   GEONAMES_ZIP  path to an already-downloaded cities500.zip (skips the fetch)
 */

import { readFileSync } from "node:fs";

import AdmZip from "adm-zip";

import { CITY_SLUGS } from "../lib/city-slugs";
import { slugify } from "../lib/city-slug";

const GEONAMES_URL = "http://download.geonames.org/export/dump/cities500.zip";

interface Row {
  geonameId: number;
  asciiName: string;
  countryCode: string;
  population: number;
  dem: number | null;
}

async function loadDump(): Promise<string> {
  const cached = process.env.GEONAMES_ZIP;
  let buf: Buffer;
  if (cached) {
    console.log(`Using cached zip: ${cached}`);
    buf = readFileSync(cached);
  } else {
    console.log("Downloading cities500.zip …");
    const res = await fetch(GEONAMES_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  const zip = new AdmZip(buf);
  const entry = zip.getEntries().find((e) => e.entryName === "cities500.txt");
  if (!entry) throw new Error("cities500.txt not found in archive");
  return entry.getData().toString("utf-8");
}

function parse(text: string): Row[] {
  // GeoNames cols: 0=geonameid, 1=name, 2=asciiname, 4=lat, 5=lon,
  //                8=country_code, 14=population, 16=dem, 17=timezone
  const rows: Row[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 18) continue;
    const dem = parseInt(cols[16], 10);
    rows.push({
      geonameId: parseInt(cols[0], 10),
      asciiName: cols[2],
      countryCode: cols[8],
      population: parseInt(cols[14], 10) || 0,
      dem: Number.isNaN(dem) || dem === -9999 ? null : dem,
    });
  }
  return rows;
}

async function main() {
  const rows = parse(await loadDump());

  // 1. Deterministic order: population DESC, geoname_id ASC.
  rows.sort((a, b) =>
    b.population - a.population || a.geonameId - b.geonameId
  );

  const taken = new Set<string>();
  const shortSlugs = new Map<string, number>(); // candidate -> how many rows wanted it
  let short = 0;
  let tiebroken = 0;
  let emptyName = 0;
  const assigned = new Set<string>();
  let noDem = 0;
  let demMin = Infinity;
  let demMax = -Infinity;

  for (const r of rows) {
    const base = slugify(r.asciiName);
    if (!base) emptyName++;
    const candidate = `${base}-${r.countryCode.toLowerCase()}`;
    shortSlugs.set(candidate, (shortSlugs.get(candidate) ?? 0) + 1);
    let slug: string;
    if (taken.has(candidate)) {
      slug = `${candidate}-${r.geonameId}`;
      tiebroken++;
    } else {
      slug = candidate;
      taken.add(candidate);
      short++;
    }
    if (assigned.has(slug)) {
      throw new Error(`duplicate slug after tiebreak: ${slug}`);
    }
    assigned.add(slug);
    if (r.dem === null) {
      noDem++;
    } else {
      if (r.dem < demMin) demMin = r.dem;
      if (r.dem > demMax) demMax = r.dem;
    }
  }

  // 2. Curated namespace: every distinct localized slug in lib/city-slugs.ts.
  const curated = new Set<string>();
  for (const perLocale of Object.values(CITY_SLUGS)) {
    for (const s of Object.values(perLocale)) curated.add(s);
  }
  const clashes = [...assigned].filter((s) => curated.has(s));

  const topGroups = [...shortSlugs.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);

  const pct = (n: number) => ((n / rows.length) * 100).toFixed(1).replace(".", ",");

  console.log("");
  console.log(`filas totales:                ${rows.length}`);
  console.log(`slugs cortos (nombre-cc):     ${short}`);
  console.log(
    `slugs con desempate (-id):    ${tiebroken}   (${pct(tiebroken)} %)`
  );
  console.log(
    `top 10 grupos en colisión:    ${topGroups
      .map(([s, n]) => `${s}=${n}`)
      .join(", ")}`
  );
  console.log(`slugs distintos en CITY_SLUGS: ${curated.size}`);
  console.log(
    `slugs que chocan con CITY_SLUGS: ${clashes.length}   <-- tiene que ser 0`
  );
  if (clashes.length) {
    console.log(`  colisiones: ${clashes.slice(0, 50).join(", ")}`);
  }
  console.log(`asciiname que slugifica a vacío: ${emptyName}`);
  console.log(`filas sin dem (-9999 o vacío): ${noDem}   (${pct(noDem)} %)`);
  const longest = [...assigned].reduce((a, b) => (b.length > a.length ? b : a));
  console.log(`slug más largo:               ${longest.length} chars (${longest})`);
  console.log(`elevación: min ${demMin} m, max ${demMax} m`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
