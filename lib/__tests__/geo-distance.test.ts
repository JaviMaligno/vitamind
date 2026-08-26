import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

// The spec (§4.1) keeps `haversineKm` re-exported from lib/nearest-city.ts, because
// lib/elevation.ts and lib/history-window.ts import it from there and must not be
// touched. So the NUMERIC contract of the extracted module is asserted through that
// re-export, which resolves today — every failure in this file is then an assertion
// about behaviour, never a module-resolution error.
import { haversineKm } from "@/lib/nearest-city";

const ROOT = process.cwd();
const GEO_MODULE = path.join(ROOT, "lib", "geo-distance.ts");

/** Every .ts/.tsx file under `dir`, skipping `__tests__` (a test may quote a number). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("lib/geo-distance.ts — the one haversine", () => {
  // D-8: the module that CityIndexSearch (a client island over the SSG index) pulls
  // in must not drag BUILTIN_CITIES or lib/flag into the browser bundle. The way to
  // guarantee that is structural, not a comment: zero imports.
  it("exists as its own module", () => {
    expect(existsSync(GEO_MODULE)).toBe(true);
  });

  it("has no imports at all", () => {
    expect(existsSync(GEO_MODULE)).toBe(true);
    const src = readFileSync(GEO_MODULE, "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\brequire\s*\(/);
    expect(src).not.toMatch(/\bfrom\s+["']/);
  });

  it("exports haversineKm", () => {
    expect(existsSync(GEO_MODULE)).toBe(true);
    const src = readFileSync(GEO_MODULE, "utf8");
    expect(src).toMatch(/export\s+function\s+haversineKm\s*\(/);
  });

  // Verification contract §8.4: one definition of the earth radius across the whole
  // client+lib surface. Today there are four byte-distinct copies (nearest-city,
  // city-nearby, continent, city-client-links).
  it("is the only place that defines the earth radius", () => {
    const files = [...sourceFiles(path.join(ROOT, "lib")), ...sourceFiles(path.join(ROOT, "components"))];
    const withRadius = files.filter((f) => /6371/.test(readFileSync(f, "utf8")));
    expect(withRadius.map((f) => path.relative(ROOT, f).replace(/\\/g, "/"))).toEqual(["lib/geo-distance.ts"]);
  });
});

describe("the dead 'nearest city' implementations are gone", () => {
  // Verification contract §8.9. `findNearestCity` (lib/cities.ts) matches on LATITUDE
  // ALONE with a 3 deg cap and then writes lon/tz/timezone from the match
  // (hooks/useLocation.ts:88); `selectFromHeatmap` is its only caller and nothing
  // consumes it from the context. Note `findNearestCityApi` (lib/cities-api.ts) is a
  // different function and stays.
  const scan = (dirs: string[], re: RegExp) =>
    dirs
      .flatMap((d) => sourceFiles(path.join(ROOT, d)))
      .filter((f) => re.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, "/"));

  const DIRS = ["app", "components", "hooks", "context", "lib", "widgets"].filter((d) =>
    existsSync(path.join(ROOT, d)),
  );

  it("no longer defines or calls findNearestCity", () => {
    expect(scan(DIRS, /\bfindNearestCity\b/)).toEqual([]);
  });

  it("no longer defines or exposes selectFromHeatmap", () => {
    expect(scan(DIRS, /\bselectFromHeatmap\b/)).toEqual([]);
  });

  it("no longer keeps a private 400 km link cap", () => {
    expect(scan(["lib", "components"], /maxKm\s*=\s*400\b/)).toEqual([]);
  });
});

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(40.42, -3.7, 40.42, -3.7)).toBe(0);
  });

  it("is symmetric", () => {
    const ab = haversineKm(40.42, -3.7, 41.9, 12.5);
    const ba = haversineKm(41.9, 12.5, 40.42, -3.7);
    expect(ab).toBeCloseTo(ba, 10);
  });

  // One degree of longitude on the equator is one degree of great circle.
  it("gives 111.19 km per degree on the equator", () => {
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.1949, 3);
  });

  // Half the circumference: the function must not overflow asin at the antipode.
  it("gives half the circumference between antipodes", () => {
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(20015.0868, 2);
    expect(haversineKm(90, 0, -90, 0)).toBeCloseTo(20015.0868, 2);
  });

  // The pair the chip's copy is pinned to (Toledo → builtin Madrid at 40.42/-3.70).
  it("puts Toledo 68 km from Madrid", () => {
    expect(haversineKm(39.8581, -4.0226, 40.42, -3.7)).toBeCloseTo(68.23, 2);
  });

  it("puts Naples 188 km from Rome", () => {
    expect(haversineKm(40.8518, 14.2681, 41.9, 12.5)).toBeCloseTo(188.01, 2);
  });
});
