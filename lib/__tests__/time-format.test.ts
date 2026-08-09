import { describe, it, expect } from "vitest";
import { fmtTime, fmtDayLength } from "../solar";

/**
 * Rounding the minute without carrying into the hour produced "20:60" and
 * "13 h 60 min" in the static HTML of the sunrise pages — the ones Google
 * indexes and shows for "a qué hora se pone el sol". Roughly one value in
 * sixty lands in the last 30 seconds of a minute, which is where it happens.
 */
describe("fmtTime carries the rounded minute into the hour", () => {
  it("renders 20:59:45 as 21:00, not 20:60", () => {
    expect(fmtTime(20 + 59.75 / 60)).toBe("21:00");
  });

  it("renders 13:59:42 as 14:00, not 13:60", () => {
    expect(fmtTime(13 + 59.7 / 60)).toBe("14:00");
  });

  it("wraps the last minute of the day to 00:00, not 23:60", () => {
    expect(fmtTime(23 + 59.9 / 60)).toBe("00:00");
  });

  it("leaves times that need no carry alone", () => {
    expect(fmtTime(7.2)).toBe("07:12");
    expect(fmtTime(21.5)).toBe("21:30");
    expect(fmtTime(0)).toBe("00:00");
  });
});

describe("fmtDayLength carries the rounded minute into the hour", () => {
  it("renders 13 h 59.7 min as 14 h 00 min, not 13 h 60 min", () => {
    expect(fmtDayLength(839.7)).toBe("14 h 00 min");
  });

  it("pads the minutes to two digits", () => {
    expect(fmtDayLength(826)).toBe("13 h 46 min");
    expect(fmtDayLength(485)).toBe("8 h 05 min");
  });

  it("handles a whole number of hours", () => {
    expect(fmtDayLength(720)).toBe("12 h 00 min");
    expect(fmtDayLength(0)).toBe("0 h 00 min");
  });
});
