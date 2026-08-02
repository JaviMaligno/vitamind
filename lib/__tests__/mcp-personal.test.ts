import { describe, it, expect } from "vitest";
import {
  myProfileTool, myCitiesTool, myHistoryTool, logSunSessionTool, updateMyProfileTool,
  type ProfileStore, type ProfileRow,
} from "../mcp-personal";
import type { DayRecord } from "../types";

function memoryStore(rows: Record<string, ProfileRow>): ProfileStore {
  return {
    async getProfile(userId) { return rows[userId] ?? null; },
    async updateHistory(userId, history) {
      rows[userId].history = history as DayRecord[];
    },
    async updateProfile(userId, patch) {
      Object.assign(rows[userId], patch);
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
    const r = await myHistoryTool(store, "u1", { days: 30 }, new Date("2026-07-20T09:00:00Z"));
    if ("daysTracked" in r) {
      expect(r.daysTracked).toBe(3);
      expect(r.daysConfirmedOutside).toBe(2);
      // Most recent day (07-19) is unconfirmed, so the streak is 0.
      expect(r.currentConfirmedStreak).toBe(0);
    }
  });

  /**
   * `days` counted stored records rather than calendar days, so a user who opens
   * the app in bursts got a window as long as their gaps: 30 records spread over
   * 18 April – 30 July came back for `days: 30`, and the widget drew them as 30
   * consecutive squares. Someone reading it saw a month that was really three
   * and a half.
   */
  describe("the window is calendar days, not records", () => {
    // Three bursts with long gaps, the shape a real profile has.
    const SPARSE: ProfileRow = {
      ...PROFILE,
      history: [
        record("2026-04-18", true), record("2026-04-19", true), record("2026-04-20", null),
        record("2026-05-04", true), record("2026-05-05", null),
        record("2026-07-13", true), record("2026-07-14", true), record("2026-07-15", null),
      ],
    };
    const NOW = new Date("2026-08-01T10:00:00Z");

    it("drops records older than the window, however few records that leaves", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW);
      if (!("records" in r)) throw new Error("expected records");
      // 30 days back from 1 August is 3 July: only the July burst survives.
      // Records stay newest-first, as they always were.
      expect(r.records.map((x) => x.date)).toEqual(["2026-07-15", "2026-07-14", "2026-07-13"]);
      expect(r.daysTracked).toBe(3);
    });

    it("reports the window it actually covered, ending today", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW);
      // Without these the widget cannot draw the days that have no record —
      // including today, which is exactly where someone looks first.
      expect(r).toMatchObject({ from: "2026-07-03", to: "2026-08-01" });
    });

    it("reaches back far enough when asked for a year", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 365 }, NOW);
      if (!("records" in r)) throw new Error("expected records");
      expect(r.records).toHaveLength(8);
      expect(r.from).toBe("2025-08-02");
    });

    /**
     * The widget got a fifth state for days with no record; the model's channel
     * did not, so it read a gap as unknowable and said so: "no se puede
     * distinguir si no hubo sol útil o simplemente no se registró". The server
     * knows the difference — records exist only for days the app was opened —
     * and had simply never said it.
     */
    it("says what a missing day means, rather than leaving the model to guess", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW);
      if (!("daysWithoutRecord" in r)) throw new Error("expected the gap count");
      // 3 July – 1 August is 30 days; three of them have records.
      expect(r.daysWithoutRecord).toBe(27);
      expect(r.recordsCover).toMatch(/not that the sun was insufficient/i);
    });

    it("reports no gaps when every day in the window was logged", async () => {
      const dense: ProfileRow = {
        ...PROFILE,
        history: ["2026-07-30", "2026-07-31", "2026-08-01"].map((d) => record(d, true)),
      };
      const store = memoryStore({ u1: dense });
      const r = await myHistoryTool(store, "u1", { days: 3 }, NOW);
      if (!("daysWithoutRecord" in r)) throw new Error("expected the gap count");
      expect(r.daysWithoutRecord).toBe(0);
    });

    it("counts the streak from today's end of the window, not from the last record", async () => {
      // The most recent record is 15 July, unconfirmed — and two weeks stale.
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW);
      if (!("currentConfirmedStreak" in r)) throw new Error("expected streak");
      expect(r.currentConfirmedStreak).toBe(0);
    });
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

describe("updateMyProfileTool", () => {
  it("writes only the fields it was given", async () => {
    const rows = { u: { ...PROFILE } };
    const result = await updateMyProfileTool(memoryStore(rows), "u", { skinType: 5 });

    expect(result).toMatchObject({ saved: true });
    expect(rows.u.skin_type).toBe(5);
    // Everything else is left exactly as it was: this tool sets the four
    // synthesis inputs, it does not rewrite a profile row.
    expect(rows.u.area_fraction).toBe(PROFILE.area_fraction);
    expect(rows.u.age).toBe(PROFILE.age);
    expect(rows.u.favorites).toEqual(PROFILE.favorites);
    expect(rows.u.history).toEqual(PROFILE.history);
  });

  it("clamps rather than storing whatever it is handed", async () => {
    const rows = { u: { ...PROFILE } };
    await updateMyProfileTool(memoryStore(rows), "u", {
      skinType: 42, exposedSkinFraction: 9, age: 500, targetIU: 1,
    });
    expect(rows.u.skin_type).toBe(6);
    expect(rows.u.area_fraction).toBe(1);
    expect(rows.u.age).toBe(120);
    expect(rows.u.target_iu).toBe(100);
  });

  it("accepts an explicit null age — 'adult baseline' is a real choice", async () => {
    const rows = { u: { ...PROFILE } };
    await updateMyProfileTool(memoryStore(rows), "u", { age: null });
    expect(rows.u.age).toBeNull();
  });

  it("refuses an empty write instead of touching the row", async () => {
    const rows = { u: { ...PROFILE } };
    let wrote = false;
    const store: ProfileStore = {
      ...memoryStore(rows),
      async updateProfile() { wrote = true; },
    };
    const result = await updateMyProfileTool(store, "u", {});
    expect(result).toMatchObject({ saved: false, reason: "nothing_to_update" });
    expect(wrote).toBe(false);
  });

  it("says so when the user has no profile row at all", async () => {
    const result = await updateMyProfileTool(memoryStore({}), "nobody", { skinType: 3 });
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("logSunSessionTool: three answers", () => {
  it("records an explicit 'had sun and stayed in' as false", async () => {
    // Distinct from null: false is an answer, null is the absence of one.
    const rows = { u: { ...PROFILE, history: [record("2026-07-30", true)] } };
    const result = await logSunSessionTool(memoryStore(rows), "u", { date: "2026-07-30", confirmed: false });

    expect(result).toMatchObject({ logged: true, confirmed: false });
    expect(rows.u.history![0].userOverride).toBe(false);
  });

  it("clears back to unanswered with null", async () => {
    const rows = { u: { ...PROFILE, history: [record("2026-07-30", false)] } };
    const result = await logSunSessionTool(memoryStore(rows), "u", { date: "2026-07-30", confirmed: null });

    expect(result).toMatchObject({ logged: true });
    expect(rows.u.history![0].userOverride).toBeNull();
  });

  it("still confirms by default", async () => {
    const rows = { u: { ...PROFILE, history: [record("2026-07-30", null)] } };
    await logSunSessionTool(memoryStore(rows), "u", { date: "2026-07-30" });
    expect(rows.u.history![0].userOverride).toBe(true);
  });

  it("does not invent a row for a day the app never evaluated", async () => {
    const rows = { u: { ...PROFILE, history: [] } };
    for (const confirmed of [false, null] as const) {
      const result = await logSunSessionTool(memoryStore(rows), "u", { date: "2026-07-30", confirmed });
      expect(result).toMatchObject({ logged: false });
    }
    expect(rows.u.history).toHaveLength(0);
  });
});
