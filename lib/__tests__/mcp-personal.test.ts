import { describe, it, expect } from "vitest";
import {
  myProfileTool, myCitiesTool, myHistoryTool, logSunSessionTool,
  type ProfileStore, type ProfileRow,
} from "../mcp-personal";
import type { DayRecord } from "../types";

function memoryStore(rows: Record<string, ProfileRow>): ProfileStore {
  return {
    async getProfile(userId) { return rows[userId] ?? null; },
    async updateHistory(userId, history) {
      rows[userId].history = history as DayRecord[];
    },
  };
}

const record = (date: string, over: boolean | null, sufficient = true): DayRecord => ({
  date, cityId: "builtin:madrid", peakUVI: 7, windowStart: 11, windowEnd: 18,
  minutesNeeded: 10, sufficient, userOverride: over,
});

const PROFILE: ProfileRow = {
  skin_type: 2, area_fraction: 0.18, age: 38, target_iu: 1000,
  favorites: ["builtin:madrid", "builtin:londres", "custom:home"],
  custom_locations: [{ id: "custom:home", source: "custom", name: "Mi pueblo", lat: 41, lon: -4, tz: 1, timezone: "Europe/Madrid" }],
  last_city_id: "builtin:madrid",
  history: [record("2026-07-17", true), record("2026-07-18", true), record("2026-07-19", null)],
};

describe("personal tools", () => {
  it("get_my_profile returns the saved values and the resolved city", async () => {
    const store = memoryStore({ u1: structuredClone(PROFILE) });
    const r = await myProfileTool(store, "u1");
    expect(r).toMatchObject({ skinType: 2, exposedSkinFraction: 0.18, age: 38, targetIU: 1000 });
    if ("currentCity" in r) {
      expect(r.currentCity?.name).toBe("Madrid");
      expect(r.currentCity?.timezone).toBe("Europe/Madrid");
    }
  });

  it("reports a helpful error for accounts without a profile row", async () => {
    const store = memoryStore({});
    const r = await myProfileTool(store, "nobody");
    expect(r).toHaveProperty("error", "no_profile");
  });

  it("get_my_cities resolves builtin and custom favorites, skipping unknown ids", async () => {
    const store = memoryStore({ u1: structuredClone(PROFILE) });
    const r = await myCitiesTool(store, "u1");
    if ("favorites" in r) {
      expect(r.favorites.map((c) => c.name)).toEqual(["Madrid", "Londres", "Mi pueblo"]);
    }
  });

  it("get_my_history summarizes confirmed days and streaks", async () => {
    const store = memoryStore({ u1: structuredClone(PROFILE) });
    const r = await myHistoryTool(store, "u1", { days: 30 });
    if ("daysTracked" in r) {
      expect(r.daysTracked).toBe(3);
      expect(r.daysConfirmedOutside).toBe(2);
      // Most recent day (07-19) is unconfirmed, so the streak is 0.
      expect(r.currentConfirmedStreak).toBe(0);
    }
  });

  it("log_sun_session confirms an existing day and creates missing ones", async () => {
    const rows = { u1: structuredClone(PROFILE) };
    const store = memoryStore(rows);

    const r1 = await logSunSessionTool(store, "u1", { date: "2026-07-19", minutes: 20 });
    expect(r1).toMatchObject({ logged: true, date: "2026-07-19", minutesReported: 20 });
    expect(rows.u1.history!.find((h) => h.date === "2026-07-19")!.userOverride).toBe(true);

    await logSunSessionTool(store, "u1", { date: "2026-07-10" });
    const created = rows.u1.history!.find((h) => h.date === "2026-07-10");
    expect(created).toBeTruthy();
    expect(created!.userOverride).toBe(true);
    expect(created!.cityId).toBe("builtin:madrid");
  });
});
