import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NOTIFY_LOCAL_HOUR_START, NOTIFY_LOCAL_HOUR_END } from "@/lib/push-schedule";

/**
 * `vercel.json` is not typechecked, not linted and not exercised by any other
 * test, and a mistake in it is only discovered by a deployment — at the end of a
 * ~22-minute build, or worse, silently, by nobody getting a notification.
 *
 * Two invariants are worth holding here, and both are properties of the plan the
 * project is on rather than of the code:
 *
 *  1. This account is on Vercel's HOBBY plan, where a cron expression that would
 *     run more than once a day FAILS THE DEPLOYMENT ("Hobby accounts are limited
 *     to daily cron jobs"). So the hourly push cannot be written `0 * * * *`; it
 *     is 24 separate once-a-day entries on the same path, which the platform
 *     supports explicitly. Anyone tidying those 24 lines into one expression is
 *     about to break a deploy.
 *
 *  2. Those 24 entries must actually cover all 24 UTC hours. A gap is a band of
 *     longitudes whose subscribers silently stop being notified — the failure
 *     this whole change exists to remove, reintroduced by an off-by-one.
 */

interface CronEntry {
  path: string;
  schedule: string;
}

const config = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as { crons: CronEntry[] };

describe("vercel.json cron schedules", () => {
  it("declares no expression that would run more than once a day", () => {
    for (const { path, schedule } of config.crons) {
      const [minute, hour] = schedule.split(/\s+/);
      // A single literal minute and a single literal hour is the only shape that
      // fires once per day. `*`, `*/n`, `a,b` and `a-b` in either field all fire
      // more often and are rejected at deploy time on Hobby.
      expect(minute, `minute field of "${schedule}" (${path})`).toMatch(/^\d{1,2}$/);
      expect(hour, `hour field of "${schedule}" (${path})`).toMatch(/^\d{1,2}$/);
      expect(Number(minute)).toBeLessThan(60);
      expect(Number(hour)).toBeLessThan(24);
    }
  });

  it("invokes the push broadcaster once in every UTC hour", () => {
    const hours = config.crons
      .filter((c) => c.path === "/api/push/notify")
      .map((c) => Number(c.schedule.split(/\s+/)[1]))
      .sort((a, b) => a - b);
    expect(hours).toEqual(Array.from({ length: 24 }, (_, h) => h));
  });

  /**
   * Hobby fires a cron anywhere inside its hour, so consecutive runs are up to
   * 1 h 59 m apart. The local window has to be wider than that gap or a
   * subscriber can be stepped over entirely.
   */
  it("keeps the local send window wider than the worst gap the schedule can produce", () => {
    expect(NOTIFY_LOCAL_HOUR_END - NOTIFY_LOCAL_HOUR_START).toBeGreaterThan(2);
  });

  it("still regenerates the today hubs once a day", () => {
    const hub = config.crons.filter((c) => c.path === "/api/revalidate-today");
    expect(hub).toHaveLength(1);
    expect(hub[0].schedule).toBe("10 0 * * *");
  });
});
