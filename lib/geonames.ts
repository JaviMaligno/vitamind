import Fuse from "fuse.js";
import { ccToFlag } from "./cc-flag";
import { aliasSlug } from "./city-dynamic-slug";
import type { City } from "./types";

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
        // The local fallback has ids, not slugs — the slug map lives in the
        // database. It emits the alias form, which the city route answers with
        // a 301 to the canonical URL (lib/city-dynamic-slug.ts). One extra hop
        // beats a dead link. Built through `aliasSlug` rather than inlined, so
        // the shape stays decided in exactly one file.
        slug: aliasSlug(r.i),
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
