import { describe, it, expect, beforeEach } from "vitest";
import { loadFavorites, saveFavorites } from "@/lib/storage";

const MIGRATION_KEY = "vitamind:legacyFavMigration";

const LEGACY_DEFAULT = [
  "builtin:londres", "builtin:madrid", "builtin:estocolmo", "builtin:nueva-york",
  "builtin:tokio", "builtin:nairobi", "builtin:sidney", "builtin:bogota",
  "builtin:reikiavik", "builtin:ciudad-del-cabo",
];

describe("legacy default-favorites migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears favorites that exactly match the old prototype default set", () => {
    saveFavorites([...LEGACY_DEFAULT]);
    expect(loadFavorites()).toEqual([]);
    // Runs only once — the flag is set.
    expect(localStorage.getItem(MIGRATION_KEY)).toBe("1");
  });

  it("ignores order when matching the legacy set", () => {
    saveFavorites([...LEGACY_DEFAULT].reverse());
    expect(loadFavorites()).toEqual([]);
  });

  it("leaves a curated list untouched (superset of the legacy set)", () => {
    const curated = [...LEGACY_DEFAULT, "builtin:paris"];
    saveFavorites(curated);
    expect(loadFavorites()).toEqual(curated);
  });

  it("leaves a curated list untouched (subset / different cities)", () => {
    const curated = ["builtin:madrid", "builtin:paris"];
    saveFavorites(curated);
    expect(loadFavorites()).toEqual(curated);
  });

  it("does not re-clear if the user later re-adds exactly the legacy set", () => {
    saveFavorites([...LEGACY_DEFAULT]);
    expect(loadFavorites()).toEqual([]); // migration runs, flag set

    // User deliberately re-creates the same 10 cities afterwards.
    saveFavorites([...LEGACY_DEFAULT]);
    expect(loadFavorites()).toEqual(LEGACY_DEFAULT);
  });

  it("returns an empty default for a first-time visitor", () => {
    expect(loadFavorites()).toEqual([]);
  });
});
