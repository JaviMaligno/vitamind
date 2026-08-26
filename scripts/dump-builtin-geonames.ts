/**
 * Generates `lib/builtin-geonames.ts`: the GeoNames id of each of the 73 curated
 * cities.
 *
 * Usage:  npx tsx scripts/dump-builtin-geonames.ts > lib/builtin-geonames.ts
 *         (the module goes to stdout; the audit report goes to stderr)
 *
 * WHY THIS MAP EXISTS. Without it `/vitamina-d/edinburgh-gb` would serve a
 * SECOND page for Edinburgh, competing with the curated `/vitamina-d/edimburgo`
 * for the same query. The route uses this map to answer 301 instead. It cannot
 * be derived: not from the slug (the curated slug is localized, the dynamic one
 * is the GeoNames ASCII name), and not from the coordinates alone (Getafe is
 * 13 km from Madrid and is not Madrid).
 *
 * WHY OFFLINE, AGAINST THE DUMP, AND NOT AGAINST SUPABASE. The plan's Paso 15
 * sketched a proximity RPC against the `cities` table. The dump is the better
 * source for three reasons and the same rows either way:
 *   1. `cities` is seeded FROM this dump, so the dump is upstream of it; the ids
 *      are identical and the dump additionally carries the 5,096 rows the table
 *      does not have yet (235,503 vs 230,407 at 2026-08-26).
 *   2. It is reproducible by anyone with no credentials, which is what makes the
 *      generated file auditable rather than a snapshot of one person's database.
 *   3. It writes nothing, and touches nothing that serves production traffic.
 * The MATCHING STRATEGY is the plan's, unchanged: a candidate must be within
 * MAX_KM of the curated coordinates AND carry a name that slugifies to one of
 * that city's six localized slugs.
 *
 * Optional env:
 *   GEONAMES_ZIP  path to an already-downloaded cities500.zip (skips the fetch)
 */

import { readFileSync } from "node:fs";

import AdmZip from "adm-zip";

import { BUILTIN_CITIES } from "../lib/cities";
import { CITY_SLUGS } from "../lib/city-slugs";
import { slugify } from "../lib/city-slug";
import { baseSlug } from "../lib/city-routes";
import { haversineKm } from "../lib/geo-distance";

const GEONAMES_URL = "http://download.geonames.org/export/dump/cities500.zip";

/**
 * A curated city and its GeoNames row are the same place when they are this
 * close. Chosen to be wide enough for the offset between a curated centre and
 * the GeoNames point (both are city centres, so the gap is a few km at most)
 * and narrow enough that a distinct neighbouring city cannot slip in — the
 * closest such pair in the curated set is far above it.
 */
const MAX_KM = 25;

/**
 * The cities whose GeoNames row cannot be reached by name, listed one by one
 * with the reason. Every entry is verified below against the dump: the id must
 * exist and its coordinates must be within MAX_KM. This table is the audited
 * part of the map — nothing is resolved silently.
 */
const MANUAL: Record<string, { id: number; why: string }> = {
  "nueva-york": {
    id: 5128581,
    why: 'GeoNames names it "New York City"; none of the six curated slugs carries the "City" suffix. 0.6 km away, pop 8.8M — the boroughs (Brooklyn, Queens, Manhattan) are separate rows and are NOT it.',
  },
  "las-palmas": {
    id: 2515270,
    why: 'GeoNames names it "Las Palmas de Gran Canaria"; the curated page uses the short form every locale uses. 0.6 km away, pop 383,516.',
  },
  tenerife: {
    id: 2511174,
    why: 'The curated page is named after the ISLAND but is sited on its capital: its coordinates (28.47, -16.25) are Santa Cruz de Tenerife, 0.5 km from this row. cities500 has no row for the island, so the alternative is leaving Santa Cruz to open a second page for the same coordinates.',
  },
};

interface Row {
  geonameId: number;
  name: string;
  asciiName: string;
  countryCode: string;
  lat: number;
  lon: number;
  population: number;
}

async function loadDump(): Promise<string> {
  const cached = process.env.GEONAMES_ZIP;
  let buf: Buffer;
  if (cached) {
    console.error(`Using cached zip: ${cached}`);
    buf = readFileSync(cached);
  } else {
    console.error("Downloading cities500.zip …");
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
    rows.push({
      geonameId: parseInt(cols[0], 10),
      name: cols[1],
      asciiName: cols[2],
      countryCode: cols[8],
      lat: parseFloat(cols[4]),
      lon: parseFloat(cols[5]),
      population: parseInt(cols[14], 10) || 0,
    });
  }
  return rows;
}

/** The six localized slugs of a curated city, as a lookup set. */
function localizedSlugs(base: string): Set<string> {
  const perLocale = CITY_SLUGS[base];
  if (!perLocale) throw new Error(`no CITY_SLUGS entry for "${base}"`);
  return new Set(Object.values(perLocale));
}

async function main() {
  const rows = parse(await loadDump());
  console.error(`rows in dump: ${rows.length}`);

  const map: Record<string, number> = {};
  const unresolved: string[] = [];
  const report: string[] = [];

  for (const city of BUILTIN_CITIES) {
    const base = baseSlug(city.id);
    const slugs = localizedSlugs(base);

    const near = rows
      .map((r) => ({ r, km: haversineKm(city.lat, city.lon, r.lat, r.lon) }))
      .filter((c) => c.km <= MAX_KM);

    const byName = near.filter(
      ({ r }) => slugs.has(slugify(r.asciiName)) || slugs.has(slugify(r.name)),
    );

    // Among same-named neighbours (a suburb repeating the city's name), the
    // city proper is the populated one. Ties broken by id so the output never
    // depends on the order of lines in the dump.
    byName.sort(
      (a, b) => b.r.population - a.r.population || a.r.geonameId - b.r.geonameId,
    );

    const manual = MANUAL[base];
    if (byName.length > 0) {
      const best = byName[0];
      map[base] = best.r.geonameId;
      const others = byName
        .slice(1)
        .map((c) => `${c.r.asciiName}#${c.r.geonameId}(${c.r.population})`);
      report.push(
        `  ok       ${base.padEnd(20)} ${String(best.r.geonameId).padEnd(9)}` +
          ` ${best.r.asciiName} (${best.r.countryCode}, ${best.km.toFixed(1)} km,` +
          ` pop ${best.r.population})` +
          (others.length ? `  [also matched: ${others.join(", ")}]` : ""),
      );
      if (manual) {
        console.error(
          `  WARNING  ${base} matched by name but also has a MANUAL entry — remove it`,
        );
      }
      continue;
    }

    if (manual) {
      const row = rows.find((r) => r.geonameId === manual.id);
      if (!row) {
        unresolved.push(`${base}: MANUAL id ${manual.id} is not in the dump`);
        continue;
      }
      const km = haversineKm(city.lat, city.lon, row.lat, row.lon);
      if (km > MAX_KM) {
        unresolved.push(
          `${base}: MANUAL id ${manual.id} (${row.asciiName}) is ${km.toFixed(1)} km away, over ${MAX_KM}`,
        );
        continue;
      }
      map[base] = manual.id;
      report.push(
        `  manual   ${base.padEnd(20)} ${String(manual.id).padEnd(9)}` +
          ` ${row.asciiName} (${row.countryCode}, ${km.toFixed(1)} km,` +
          ` pop ${row.population}) — ${manual.why}`,
      );
      continue;
    }

    // Nothing matched by name. Print the plausible neighbours so the reason is
    // visible in the report instead of having to be re-derived by hand.
    const hint = near
      .sort((a, b) => b.r.population - a.r.population)
      .slice(0, 5)
      .map((c) => `${c.r.asciiName}#${c.r.geonameId}(${c.km.toFixed(1)}km,${c.r.population})`)
      .join(", ");
    unresolved.push(
      `${base} [${city.name}] wanted one of {${[...slugs].join(", ")}}; nearest: ${hint || "none"}`,
    );
  }

  console.error("");
  for (const line of report.sort()) console.error(line);
  console.error("");
  console.error(`resolved: ${Object.keys(map).length} / ${BUILTIN_CITIES.length}`);

  if (unresolved.length) {
    console.error("");
    console.error(`UNRESOLVED (${unresolved.length}) — add a MANUAL entry for each:`);
    for (const u of unresolved) console.error(`  ${u}`);
    process.exit(1);
  }

  const dupes = new Map<number, string[]>();
  for (const [base, id] of Object.entries(map)) {
    dupes.set(id, [...(dupes.get(id) ?? []), base]);
  }
  const collisions = [...dupes.entries()].filter(([, bases]) => bases.length > 1);
  if (collisions.length) {
    console.error("");
    console.error("DUPLICATE ids — two curated cities cannot be the same place:");
    for (const [id, bases] of collisions) console.error(`  ${id}: ${bases.join(", ")}`);
    process.exit(1);
  }

  const entries = Object.keys(map)
    .sort()
    .map((base) => `  "${base}": ${map[base]},`)
    .join("\n");

  process.stdout.write(
    `// GENERATED by scripts/dump-builtin-geonames.ts — do not edit by hand.
//   npx tsx scripts/dump-builtin-geonames.ts > lib/builtin-geonames.ts
//
// The GeoNames id of each curated city. It is what lets the route answer 301 to
// the curated URL when someone asks for that city's QUALIFIED form
// (\`/vitamina-d/shanghai-cn\` -> \`/vitamina-d/shanghai\`), so one city never has
// two pages.
//
// The GEOGRAPHY is checked by the generator, not by a test: a GeoNames row
// qualifies only within ${MAX_KM} km of the curated coordinates AND with a name that
// slugifies to one of that city's six localized slugs. What
// lib/__tests__/builtin-geonames.test.ts pins is the RESULT — all 73 covered,
// no duplicate ids, and the three entries that needed a human decision.
export const BUILTIN_GEONAME_ID: Record<string, number> = {
${entries}
};
`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
