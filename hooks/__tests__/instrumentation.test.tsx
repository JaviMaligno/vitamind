import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StrictMode } from "react";
import type { City } from "@/lib/types";

/**
 * The instrumentation is only worth having if it counts what actually happened.
 * These tests drive the real hooks and assert on what reaches the NETWORK — the
 * queue, the serialisation and the beacon all run for real; only `sendBeacon`
 * itself is stubbed. Mocking one layer higher would have let a batching or
 * encoding bug through while every test stayed green.
 *
 * Every case here is a way the counts could silently lie: a double-fire under
 * StrictMode, a cloud sync impersonating user intent, an ad blocker turning a
 * tracking call into a crash. A wrong number is worse than no number, because
 * a product decision gets made on it.
 */
const beacon = vi.fn<(url: string, blob: unknown) => boolean>(() => true);

// A stored cloud profile, so the login path really walks through the setters.
vi.mock("@/lib/profile", () => ({
  loadProfile: vi.fn(async () => ({
    profile: {
      skinType: 5, areaFraction: 0.5, age: 41, targetIU: 2000,
      favorites: ["madrid"], customLocations: [], history: [], lastCityId: "madrid",
    },
  })),
  updateProfile: vi.fn(),
}));

import { useLocation } from "../useLocation";
import { usePreferences } from "../usePreferences";
import { emit, flushEvents } from "@/lib/analytics";

const city = (over: Partial<City> = {}): City => ({
  id: "madrid",
  name: "Madrid",
  lat: 40.4,
  lon: -3.7,
  tz: 1,
  timezone: "Europe/Madrid",
  flag: "\u{1F1EA}\u{1F1F8}",
  source: "builtin",
  ...over,
});

interface SentEvent { name: string; props?: Record<string, unknown> }

/** Every event actually serialised onto the wire, in order. */
function sent(): SentEvent[] {
  flushEvents();
  return beacon.mock.calls.flatMap((call) => {
    const body = (call as unknown as [string, Blob])[1] as unknown as { text?: () => string };
    // jsdom's Blob has no sync reader; the stub below stores the raw string.
    const raw = (body as unknown as { __raw: string }).__raw;
    return (JSON.parse(raw).events ?? []) as SentEvent[];
  });
}

const names = () => sent().map((e) => e.name);
const propsOf = (name: string) => sent().filter((e) => e.name === name).map((e) => e.props);

beforeEach(() => {
  beacon.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  // Capture the serialised body without depending on async Blob reading.
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    writable: true,
    value: (url: string, blob: Blob & { __raw?: string }) => beacon(url, blob),
  });
  vi.stubGlobal("Blob", class {
    __raw: string;
    type: string;
    constructor(parts: string[], opts?: { type?: string }) {
      this.__raw = parts.join("");
      this.type = opts?.type ?? "";
    }
  });
});

describe("city selection", () => {
  it("reports a built-in pick and a searched place as different methods", () => {
    const { result } = renderHook(() => useLocation());

    act(() => result.current.selectCity(city()));
    act(() => result.current.selectCity(city({ id: "cuenca-x", source: "nominatim" })));

    expect(propsOf("city_selected")).toEqual([
      { method: "builtin" },
      { method: "nominatim" },
    ]);
  });

  // A GPS result is a synthesised city whose `source` is not "gps" — the id is
  // the only thing that distinguishes "used my location" from "picked a city".
  it("reports a GPS fix as gps, not as its underlying source", () => {
    const { result } = renderHook(() => useLocation());
    act(() => result.current.selectCity(city({ id: "gps:40.41,-3.70", source: "geonames" })));
    expect(propsOf("city_selected")).toEqual([{ method: "gps" }]);
  });
});

describe("favourites", () => {
  // The emit used to sit inside the setFavorites updater. React invokes updaters
  // twice under StrictMode, which silently doubled every favourite in the data.
  it("counts one event per toggle even under StrictMode", () => {
    const { result } = renderHook(() => useLocation(), { wrapper: StrictMode });

    act(() => result.current.toggleFav(city()));
    expect(names().filter((n) => n === "favorite_added")).toHaveLength(1);

    act(() => result.current.toggleFav(city()));
    expect(names().filter((n) => n === "favorite_removed")).toHaveLength(1);
  });

  it("carries the resulting total, so 'how invested is this person' is readable", () => {
    const { result } = renderHook(() => useLocation());

    act(() => result.current.toggleFav(city({ id: "a" })));
    act(() => result.current.toggleFav(city({ id: "b" })));
    act(() => result.current.toggleFav(city({ id: "a" })));

    expect(propsOf("favorite_added")).toEqual([{ total: 1 }, { total: 2 }]);
    expect(propsOf("favorite_removed")).toEqual([{ total: 1 }]);
  });
});

describe("preferences", () => {
  it("reports which field the user personalised", () => {
    const { result } = renderHook(() => usePreferences());

    act(() => result.current.setSkinType(5));
    act(() => result.current.setAge(41));

    expect(propsOf("prefs_changed")).toEqual([{ field: "skin" }, { field: "age" }]);
  });

  /**
   * The load-bearing one. Signing in restores skin type, area, age and target
   * from Supabase through the same state setters a user would touch. If those
   * writes emitted, every login would look like four deliberate personalisations
   * — and "did people bother to personalise" is exactly the question this event
   * exists to answer, so the contamination would be invisible and total.
   */
  it("stays silent when a login restores the profile from the cloud", async () => {
    const { result } = renderHook(() => usePreferences());
    const user = { id: "u1" } as Parameters<typeof result.current.handleAuthChange>[0];

    await act(async () => {
      await result.current.handleAuthChange(user, () => {}, () => {}, () => {});
    });

    // The profile really was applied — otherwise this test would pass by simply
    // never reaching the setters, which is how it was wrong the first time.
    expect(result.current.skinType).toBe(5);
    expect(result.current.age).toBe(41);
    expect(result.current.targetIU).toBe(2000);
    expect(names()).not.toContain("prefs_changed");
  });
});

describe("the tracking boundary itself", () => {
  // Ad blockers, offline, exhausted quota: `track` throwing must never surface.
  // A page that white-screens because analytics failed is strictly worse than
  // one with no analytics at all.
  it("swallows a throwing sendBeacon instead of propagating it", () => {
    beacon.mockImplementationOnce(() => { throw new Error("blocked by client"); });
    expect(() => { emit("anything"); flushEvents(); }).not.toThrow();
  });
});
