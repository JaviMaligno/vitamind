import Fuse from "fuse.js";
import type { City } from "./types";

// Country code to flag emoji
function ccToFlag(cc: string): string {
  if (cc.length !== 2) return "\u{1F4CD}";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => c.charCodeAt(0) + 0x1F1A5));
}

interface RawCity {
  i: number;  // geonameid
  n: string;  // name
  a: number;  // lat
  o: number;  // lon
  t: number;  // tz offset
  c: string;  // country code
  p: number;  // population
}

let citiesCache: City[] | null = null;
let fuseCache: Fuse<City> | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (citiesCache) return;
  if (loadPromise) return loadPromise;
  loadPromise = fetch("/cities15000.json")
    .then((r) => r.json())
    .then((raw: RawCity[]) => {
      citiesCache = raw.map((r) => ({
        id: `geonames:${r.i}`,
        name: r.n,
        lat: r.a,
        lon: r.o,
        tz: r.t,
        country: r.c,
        flag: ccToFlag(r.c),
        population: r.p,
        source: "geonames" as const,
      }));
      fuseCache = new Fuse(citiesCache, {
        keys: ["name"],
        threshold: 0.3,
        distance: 100,
        minMatchCharLength: 2,
      });
    })
    .catch(() => {
      citiesCache = [];
      fuseCache = new Fuse([], { keys: ["name"] });
    });
  return loadPromise;
}

export async function searchGeoNames(query: string, limit = 8): Promise<City[]> {
  await ensureLoaded();
  if (!fuseCache || !query.trim()) return [];
  return fuseCache.search(query, { limit }).map((r) => r.item);
}

export async function preloadGeoNames(): Promise<void> {
  await ensureLoaded();
}
