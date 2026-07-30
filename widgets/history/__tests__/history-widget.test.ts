import { describe, expect, it } from "vitest";
import { readHistoryMeta, withDayConfirmed, HISTORY_META_KEY, type HistoryDay } from "../data";
import { renderHistory, weekdayIndex } from "../render";
import { historyStrings, WIDGET_LOCALES } from "../i18n";

const wrap = (payload: unknown) => ({ content: [], _meta: { [HISTORY_META_KEY]: payload } });

const day = (date: string, over: Partial<HistoryDay> = {}): HistoryDay =>
  ({ date, viableSun: true, wentOutside: false, ...over });

describe("readHistoryMeta", () => {
  it("reads a signed-in payload", () => {
    const meta = readHistoryMeta(wrap({
      authenticated: true,
      days: [day("2026-07-01"), day("2026-07-02", { wentOutside: true })],
      streak: 1,
      daysTracked: 2,
    }));
    expect(meta?.authenticated).toBe(true);
    expect(meta?.days).toHaveLength(2);
    expect(meta?.streak).toBe(1);
  });

  it("keeps the unauthenticated flag so the widget can say so", () => {
    const meta = readHistoryMeta(wrap({ authenticated: false, days: [] }));
    expect(meta?.authenticated).toBe(false);
    expect(meta?.days).toEqual([]);
  });

  it("drops entries with no usable date rather than rendering garbage", () => {
    const meta = readHistoryMeta(wrap({
      authenticated: true,
      days: [day("2026-07-01"), { date: "yesterday" }, { viableSun: true }],
    }));
    expect(meta?.days).toHaveLength(1);
  });

  it("treats anything that is not exactly true as false", () => {
    const meta = readHistoryMeta(wrap({
      authenticated: true,
      days: [{ date: "2026-07-01", viableSun: "yes", wentOutside: 1 }],
    }));
    expect(meta?.days[0]).toEqual({ date: "2026-07-01", viableSun: false, wentOutside: false });
  });
});

describe("withDayConfirmed", () => {
  it("marks a known day", () => {
    const days = withDayConfirmed([day("2026-07-01")], "2026-07-01");
    expect(days[0].wentOutside).toBe(true);
  });

  it("adds a day the history had never recorded", () => {
    const days = withDayConfirmed([day("2026-07-01")], "2026-07-05");
    expect(days).toHaveLength(2);
    expect(days[1]).toEqual({ date: "2026-07-05", viableSun: false, wentOutside: true });
  });

  it("never un-confirms — log_sun_session has no opposite", () => {
    const days = withDayConfirmed([day("2026-07-01", { wentOutside: true })], "2026-07-01");
    expect(days[0].wentOutside).toBe(true);
  });
});

describe("weekdayIndex", () => {
  it("puts Monday first and reads the date in UTC", () => {
    expect(weekdayIndex("2026-07-27")).toBe(0); // a Monday
    expect(weekdayIndex("2026-08-02")).toBe(6); // the Sunday after
  });
});

describe("renderHistory", () => {
  const meta = {
    authenticated: true,
    days: [day("2026-07-27"), day("2026-07-28", { wentOutside: true }), day("2026-07-29", { viableSun: false })],
    streak: 1,
    daysTracked: 3,
  };

  it("asks for an account instead of drawing an empty year", () => {
    const html = renderHistory({ meta: { ...meta, authenticated: false, days: [] }, locale: "es" });
    expect(html).toContain(historyStrings("es").signedOut);
    expect(html).not.toContain("<button");
  });

  it("draws one tappable cell per day", () => {
    const html = renderHistory({ meta, locale: "en" });
    expect((html.match(/data-date=/g) ?? [])).toHaveLength(3);
    expect(html).toContain('data-date="2026-07-28" title="2026-07-28');
  });

  it("marks confirmed days differently from merely sunny ones", () => {
    const html = renderHistory({ meta, locale: "en" });
    expect((html.match(/aria-pressed="true"/g) ?? [])).toHaveLength(1);
    expect(html).toContain("#ffb020");
  });

  it("shows a tapped day as pending until the server answers", () => {
    const html = renderHistory({ meta, pending: ["2026-07-27"], locale: "en" });
    expect(html).toContain("animation:pulse");
  });

  it("shows the streak", () => {
    expect(renderHistory({ meta, locale: "en" })).toContain("day streak");
  });

  it("says so when there is nothing tracked yet", () => {
    expect(renderHistory({ meta: { ...meta, days: [] }, locale: "de" }))
      .toContain(historyStrings("de").empty);
  });

  it("pads the first week so columns line up with weekdays", () => {
    // 2026-07-29 is a Wednesday: two blank cells before it.
    const html = renderHistory({ meta: { ...meta, days: [day("2026-07-29")] }, locale: "en" });
    expect((html.match(/<span><\/span>/g) ?? [])).toHaveLength(2);
  });
});

describe("widget copy", () => {
  it("translates the signed-out state and seven weekday initials everywhere", () => {
    for (const locale of WIDGET_LOCALES) {
      const copy = historyStrings(locale);
      expect(copy.signedOut.length, locale).toBeGreaterThan(0);
      expect(copy.weekdays, locale).toHaveLength(7);
    }
  });
});
