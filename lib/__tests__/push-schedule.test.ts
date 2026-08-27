import { describe, it, expect } from "vitest";
import {
  NOTIFY_LOCAL_HOUR_START,
  NOTIFY_LOCAL_HOUR_END,
  zonedHour,
  localDayKey,
  notifyDecision,
} from "@/lib/push-schedule";

/**
 * The daily push used to be one cron at 08:00 UTC firing at every subscriber at
 * once, which is a wall-clock time only for the server: Madrid got it at 10:00,
 * New York at 04:00, Los Angeles at 01:00, Tokyo at 17:00. "Go out in the sun"
 * arrived before dawn for half the world and after sunset for the other half.
 *
 * The selection now runs on the SUBSCRIBER's clock. These tests pin the two
 * things that make that safe: the hour is read from the IANA zone (not from the
 * stored integer offset, which is wrong for half the year in every DST zone),
 * and a subscriber can be selected at most once per LOCAL day however many
 * times the endpoint is invoked.
 */

describe("zonedHour", () => {
  // 2026-08-27T08:00Z is the instant the old single cron fired.
  const at = new Date("2026-08-27T08:00:00Z");

  it("reads the local hour of each zone at one instant", () => {
    expect(zonedHour(at, "Europe/Madrid")).toBe(10); // CEST, UTC+2
    expect(zonedHour(at, "America/New_York")).toBe(4); // EDT, UTC-4
    expect(zonedHour(at, "America/Los_Angeles")).toBe(1); // PDT, UTC-7
    expect(zonedHour(at, "Asia/Tokyo")).toBe(17); // JST, UTC+9
  });

  it("handles a zone whose offset is not a whole number of hours", () => {
    // Kathmandu is UTC+5:45 — 08:00Z is 13:45 local, so the HOUR is 13.
    expect(zonedHour(at, "Asia/Kathmandu")).toBe(13);
  });

  /**
   * The load-bearing one. `tz` is an integer captured when the user subscribed,
   * so a Madrid subscriber who signed up in winter carries `tz: 1` forever. Read
   * the hour from that number in August and every decision is an hour off — the
   * same class of bug the sun tables had.
   */
  it("ignores the stored integer offset when an IANA zone is available", () => {
    const winterStamp = 1; // what a Madrid subscription stores if created in CET
    expect(zonedHour(at, "Europe/Madrid", winterStamp)).toBe(10);
    // and the stale number is what the fallback would have given:
    expect(zonedHour(at, undefined, winterStamp)).toBe(9);
  });

  it("falls back to the stored offset when there is no zone name", () => {
    expect(zonedHour(at, undefined, -5)).toBe(3);
    expect(zonedHour(at, undefined, 0)).toBe(8);
  });

  it("falls back to the stored offset when the zone name is not a zone", () => {
    expect(zonedHour(at, "Mars/Olympus_Mons", -5)).toBe(3);
  });
});

describe("localDayKey", () => {
  it("is the calendar day where the subscriber is, not where the server is", () => {
    const at = new Date("2026-08-27T23:30:00Z");
    expect(localDayKey(at, "Europe/Madrid")).toBe("2026-08-28"); // already tomorrow
    expect(localDayKey(at, "America/Los_Angeles")).toBe("2026-08-27");
    expect(localDayKey(at, "Asia/Tokyo")).toBe("2026-08-28");
  });

  it("falls back to the stored offset when there is no zone name", () => {
    expect(localDayKey(new Date("2026-08-27T23:30:00Z"), undefined, 2)).toBe("2026-08-28");
  });
});

describe("notifyDecision", () => {
  const madrid = { timezone: "Europe/Madrid", tz: 2 };

  it("selects a subscriber inside the local morning window", () => {
    // 08:00Z is 10:00 in Madrid.
    const d = notifyDecision(new Date("2026-08-27T08:00:00Z"), madrid);
    expect(d).toMatchObject({ due: true, localHour: 10, localDay: "2026-08-27" });
  });

  it("does not select a subscriber before the window", () => {
    // 06:00Z is 08:00 in Madrid.
    expect(notifyDecision(new Date("2026-08-27T06:00:00Z"), madrid)).toMatchObject({
      due: false,
      reason: "outside-window",
    });
  });

  it("does not select a subscriber after the window", () => {
    // 10:00Z is 12:00 in Madrid — the window end is exclusive.
    expect(notifyDecision(new Date("2026-08-27T10:00:00Z"), madrid)).toMatchObject({
      due: false,
      reason: "outside-window",
    });
  });

  it("never selects anyone at night, whatever the server clock says", () => {
    // The instant the old cron fired. New York and Los Angeles were asleep.
    const at = new Date("2026-08-27T08:00:00Z");
    expect(notifyDecision(at, { timezone: "America/New_York", tz: -4 }).due).toBe(false);
    expect(notifyDecision(at, { timezone: "America/Los_Angeles", tz: -7 }).due).toBe(false);
    expect(notifyDecision(at, { timezone: "Asia/Tokyo", tz: 9 }).due).toBe(false);
  });

  it("does not select a subscriber already notified on that local day", () => {
    const at = new Date("2026-08-27T08:00:00Z");
    expect(
      notifyDecision(at, { ...madrid, lastNotifiedOn: "2026-08-27" }),
    ).toMatchObject({ due: false, reason: "already-notified" });
    // Yesterday's stamp does not block today.
    expect(notifyDecision(at, { ...madrid, lastNotifiedOn: "2026-08-26" }).due).toBe(true);
  });
});

/**
 * The endpoint is now wired to 24 once-a-day cron entries, one per UTC hour,
 * because Vercel's Hobby plan rejects any expression that would run more than
 * once a day and invokes each one AT ANY POINT INSIDE ITS HOUR (±59 min).
 *
 * So the schedule cannot be relied on to be punctual — only to fire once per UTC
 * hour. Two consecutive runs are therefore never more than 1 h 59 m apart, which
 * is what makes a window WIDER than two hours land at least one run on every
 * subscriber, and the once-per-local-day guard land exactly one.
 *
 * This sweep is the proof of that argument, run against real zones on ordinary
 * days and on both kinds of DST transition day.
 */
describe("24 hourly runs with worst-case jitter select each subscriber exactly once", () => {
  const zones = [
    "Europe/Madrid",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Asia/Kathmandu", // +5:45
    "Pacific/Chatham", // +12:45 / +13:45
    "Pacific/Kiritimati", // +14, the far side of the date line
    "Pacific/Midway", // -11
  ];

  const days = [
    "2026-08-27", // ordinary day
    "2026-03-29", // EU spring forward
    "2026-10-25", // EU fall back
    "2026-03-08", // US spring forward
    "2026-11-01", // US fall back
  ];

  // Jitter patterns in minutes for the 24 runs. The alternating ones are the
  // adversarial case: 08:00 then 09:59 is the largest gap the schedule can
  // produce.
  const patterns: Record<string, (i: number) => number> = {
    punctual: () => 0,
    "always late": () => 59,
    "half past": () => 30,
    "alternating late/early": (i) => (i % 2 === 0 ? 59 : 0),
    "alternating early/late": (i) => (i % 2 === 0 ? 0 : 59),
  };

  for (const zone of zones) {
    for (const day of days) {
      for (const [name, jitter] of Object.entries(patterns)) {
        it(`${zone} on ${day} (${name})`, () => {
          const utcMidnight = Date.parse(`${day}T00:00:00Z`);
          // Two UTC days of runs, so every local day in between is fully covered
          // whatever the zone's offset from UTC.
          const sentPerLocalDay = new Map<string, number>();
          let lastNotifiedOn: string | undefined;

          for (let i = 0; i < 48; i++) {
            const at = new Date(utcMidnight + i * 3_600_000 + jitter(i) * 60_000);
            const d = notifyDecision(at, { timezone: zone, tz: 0, lastNotifiedOn });
            if (!d.due) continue;
            sentPerLocalDay.set(d.localDay, (sentPerLocalDay.get(d.localDay) ?? 0) + 1);
            lastNotifiedOn = d.localDay;
          }

          // Every local day that the 48-hour sweep covers end to end must get
          // exactly one selection. The first and last local days are clipped by
          // the sweep boundary, so only the interior ones are asserted.
          const localDays = [...sentPerLocalDay.keys()].sort();
          expect(localDays.length).toBeGreaterThanOrEqual(2);
          for (const [, count] of sentPerLocalDay) expect(count).toBe(1);
        });
      }
    }
  }
});

describe("the notify window", () => {
  it("is a morning window wider than the schedule's worst-case gap", () => {
    // Below two hours and a ±59 min schedule could step over it entirely.
    expect(NOTIFY_LOCAL_HOUR_END - NOTIFY_LOCAL_HOUR_START).toBeGreaterThan(2);
    // And it must sit in the morning: the message is an invitation to go out
    // before the day's synthesis window, which is centred on solar noon.
    expect(NOTIFY_LOCAL_HOUR_START).toBeGreaterThanOrEqual(7);
    expect(NOTIFY_LOCAL_HOUR_END).toBeLessThanOrEqual(12);
  });
});
