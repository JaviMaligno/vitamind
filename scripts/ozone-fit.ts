/**
 * Turn collected clear-sky samples into an ozone table, and REPORT WHETHER IT
 * IS SAFE TO ADOPT. See docs/ozone-rebase.md.
 *
 *   npx tsx scripts/ozone-fit.ts [--in data/ozone-samples.json] [--band 10]
 *
 * Prints, in order:
 *   1. coverage — which cells the samples actually support;
 *   2. how far the new table moves from van Heuklon, band by band;
 *   3. the residual against the samples themselves, before and after;
 *   4. the OZONE_TABLE constant to put in lib/ozone-table.ts.
 *
 * It does not write any source file. Adopting a climatology moves the figures
 * on 3,318 prerendered pages and costs a lastmod bump; that is a decision, and a
 * script should not make it by overwriting something while nobody is looking.
 */

import { readFileSync } from "node:fs";
import { fitOzoneTable, tableCoverage, impliedOzone, type OzoneSample } from "../lib/ozone-fit";
import { lookupOzone, bandCentre, type OzoneTable } from "../lib/ozone-table";
import { ozoneDU, uvIndex } from "../lib/uv-model";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function serialize(table: OzoneTable): string {
  const rows = table.values
    .map((months, i) => {
      const cells = months.map((v) => (v === null ? "null" : v.toFixed(1))).join(", ");
      return `  /* ${String(bandCentre(i, table.bandDeg)).padStart(5)}° */ [${cells}],`;
    })
    .join("\n");
  // Only the constant: lib/ozone-table.ts also holds `lookupOzone` and the
  // types, and documents the table above this line. Replace the constant there.
  return `export const OZONE_TABLE: OzoneTable = {
  bandDeg: ${table.bandDeg},
  values: [
${rows}
  ],
};
`;
}

function main() {
  const inPath = arg("in", "data/ozone-samples.json");
  const bandDeg = Number(arg("band", "10"));
  const samples: OzoneSample[] = JSON.parse(readFileSync(inPath, "utf8"));
  console.log(`[fit] ${samples.length} samples from ${inPath}\n`);

  const table = fitOzoneTable(samples, { bandDeg });
  const { filled, total, emptyBands } = tableCoverage(table);
  console.log(`COVERAGE  ${filled}/${total} cells (${((100 * filled) / total).toFixed(0)}%)`);
  if (emptyBands.length) {
    console.log(`  empty bands: ${emptyBands.map((b) => `${bandCentre(b, bandDeg)}°`).join(", ")}`);
    console.log("  (bands with no sun above 30° all year are legitimately empty)");
  }

  console.log(`\nHOW FAR THIS MOVES FROM VAN HEUKLON (DU, new minus old, at mid-month)`);
  console.log(`  band  ${MONTHS.map((m) => m.padStart(6)).join("")}`);
  table.values.forEach((months, i) => {
    const lat = bandCentre(i, bandDeg);
    if (months.every((v) => v === null)) return;
    const cells = months.map((v, m) => {
      if (v === null) return "     ·";
      const doy = Math.round(15 + m * 30.4);
      return (v - ozoneDU(lat, 0, doy)).toFixed(0).padStart(6);
    });
    console.log(`  ${String(lat).padStart(4)}° ${cells.join("")}`);
  });

  // Residual: how well each model reproduces the observations it was fitted to.
  // Reported as UV error, not ozone error, because UV is what a reader sees.
  let oldErr = 0;
  let newErr = 0;
  let n = 0;
  for (const s of samples) {
    if (impliedOzone(s.uviClearSky, s.elevationDeg, s.elevationM) === null) continue;
    const oldUVI = uvIndex(s.elevationDeg, ozoneDU(s.lat, 0, s.doy), s.elevationM);
    const newUVI = uvIndex(
      s.elevationDeg,
      lookupOzone(table, s.lat, s.doy, (la, d) => ozoneDU(la, 0, d)),
      s.elevationM,
    );
    oldErr += Math.abs(oldUVI - s.uviClearSky) / s.uviClearSky;
    newErr += Math.abs(newUVI - s.uviClearSky) / s.uviClearSky;
    n += 1;
  }
  console.log(`\nRESIDUAL against ${n} usable samples (mean |error| as a fraction of the reading)`);
  console.log(`  van Heuklon 1979 : ${((100 * oldErr) / n).toFixed(1)}%`);
  console.log(`  this table       : ${((100 * newErr) / n).toFixed(1)}%`);
  if (newErr >= oldErr) {
    console.log("\n  !! The new table is NOT better. Do not adopt it. Collect more");
    console.log("     samples, or check that the clear-sky field really is clear-sky.");
    process.exitCode = 1;
  }

  console.log(`\n${"=".repeat(72)}\nReplace the OZONE_TABLE constant in lib/ozone-table.ts with:\n${"=".repeat(72)}\n`);
  console.log(serialize(table));
}

main();
