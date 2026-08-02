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

/**
 * No provider, so every day falls back to the clear-sky model. Keeps these tests
 * off the network and deterministic; the weather path has its own tests in
 * history-window.test.ts.
 */
const NO_WEATHER = async () => null;

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

    it("answers every calendar day, not only the ones with a record", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
      if (!("records" in r)) throw new Error("expected records");
      // 3 July – 1 August, newest first, gaps included.
      expect(r.records).toHaveLength(30);
      expect(r.records[0].date).toBe("2026-08-01");
      expect(r.records.at(-1)!.date).toBe("2026-07-03");
      // Three of those thirty days were ever measured by the app.
      expect(r.daysTracked).toBe(3);
    });

    it("reports the window it actually covered, ending today", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
      expect(r).toMatchObject({ from: "2026-07-03", to: "2026-08-01" });
    });

    it("reaches back far enough when asked for a year", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 365 }, NOW, NO_WEATHER);
      if (!("records" in r)) throw new Error("expected records");
      expect(r.records).toHaveLength(365);
      expect(r.from).toBe("2025-08-02");
    });

    /**
     * A day nobody logged is a day with no *answer*, not a day with no data. The
     * model used to read the gap as unknowable and say so; now every day in the
     * span carries a window, and only "did you go out" can be blank.
     */
    it("counts the days still unanswered, and says how to read the rest", async () => {
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
      if (!("daysNotAnswered" in r)) throw new Error("expected the unanswered count");
      // Of thirty days, two were confirmed (13 and 14 July); the rest are blank.
      expect(r.daysNotAnswered).toBe(28);
      expect(r.howToRead).toMatch(/never infer it/i);
    });

    it("derives a day the app never saw, instead of leaving it empty", async () => {
      // 23 July: no record, no measurement, and still a perfectly knowable sun.
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
      if (!("records" in r)) throw new Error("expected records");
      const gap = r.records.find((x) => x.date === "2026-07-23")!;
      expect(gap.window).not.toBeNull();
      expect(gap.minutesNeeded).toBeGreaterThan(0);
      expect(gap.locationAssumed).toBe(true);
      expect(gap.wentOutside).toBeNull();
      // And it admits the cloud cover was modelled, not measured.
      expect(gap.uvSource).toBe("clear-sky");
    });

    it("stops reporting the minutes a stale profile produced", async () => {
      // The stored records claim 10 minutes; the profile in this store is what
      // decides now, and both the logged and the unlogged days agree with it.
      const store = memoryStore({ u1: structuredClone(SPARSE) });
      const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
      if (!("records" in r)) throw new Error("expected records");
      const logged = r.records.find((x) => x.date === "2026-07-13")!;
      const derived = r.records.find((x) => x.date === "2026-07-23")!;
      expect(logged.minutesNeeded).toBe(derived.minutesNeeded);
    });

    /**
     * `gps:51.5644,-0.1069` names nothing to anyone — not the reader, not the
     * model. The spans carry a name so the answer can say "London" instead of a
     * coordinate, and say which stretches were inherited.
     */
    describe("where you were", () => {
      const TRAVELLED: ProfileRow = {
        ...PROFILE,
        history: [
          { ...record("2026-07-13", true), cityId: "gps:51.5644,-0.1069" },
          { ...record("2026-07-20", null), cityId: "builtin:valencia" },
          { ...record("2026-07-28", true), cityId: "gps:51.5644,-0.1069" },
        ],
      };

      it("reports the stretches, not one entry per day", async () => {
        const store = memoryStore({ u1: structuredClone(TRAVELLED) });
        const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
        if (!("locations" in r)) throw new Error("expected locations");
        // Thirty days, three stretches: London, the day in Valencia, London again.
        expect(r.locations).toHaveLength(3);
        expect(r.locations.map((l) => l.days).reduce((a, b) => a + b)).toBe(30);
      });

      it("names a coordinate after the nearest city it can vouch for", async () => {
        const store = memoryStore({ u1: structuredClone(TRAVELLED) });
        const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
        if (!("locations" in r)) throw new Error("expected locations");
        expect(r.locations[0].name).toMatch(/london|londres/i);
        expect(r.locations[1].name).toMatch(/valencia/i);
      });

      it("falls back to the coordinate rather than naming a city 500 km away", async () => {
        const middleOfNowhere: ProfileRow = {
          ...PROFILE,
          history: [{ ...record("2026-07-20", null), cityId: "gps:12.5,-58.0" }],
        };
        const store = memoryStore({ u1: middleOfNowhere });
        const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
        if (!("locations" in r)) throw new Error("expected locations");
        expect(r.locations[0].name).toBe("12.5, -58.0");
      });

      it("says how much of each stretch was inherited", async () => {
        const store = memoryStore({ u1: structuredClone(TRAVELLED) });
        const r = await myHistoryTool(store, "u1", { days: 30 }, NOW, NO_WEATHER);
        if (!("locations" in r)) throw new Error("expected locations");
        // Only three days in the whole window were ever recorded.
        const inherited = r.locations.map((l) => l.assumedDays).reduce((a, b) => a + b);
        expect(inherited).toBe(27);
      });
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
