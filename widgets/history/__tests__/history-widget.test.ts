import { describe, expect, it } from "vitest";
import { readHistoryMeta, withDayConfirmed, nextAnswer, HISTORY_META_KEY, type HistoryDay } from "../data";
import { renderHistory, weekdayIndex, cellLabel, dayParts, cellState } from "../render";
import { historyStrings, WIDGET_LOCALES } from "../i18n";

const wrap = (payload: unknown) => ({ content: [], _meta: { [HISTORY_META_KEY]: payload } });

// Default answer is null, not false: with three states, false stopped meaning
// "unconfirmed" and started meaning "had sun and stayed in".
const day = (date: string, over: Partial<HistoryDay> = {}): HistoryDay =>
  ({ date, viableSun: true, wentOutside: null, ...over });

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

  it("keeps the three answers apart and calls anything else 'never said'", () => {
    const meta = readHistoryMeta(wrap({
      authenticated: true,
      days: [
        { date: "2026-07-01", viableSun: true, wentOutside: true },
        { date: "2026-07-02", viableSun: true, wentOutside: false },
        { date: "2026-07-03", viableSun: true, wentOutside: 1 },
        { date: "2026-07-04", viableSun: "yes" },
      ],
    }));
    expect(meta?.days.map((d) => d.wentOutside)).toEqual([true, false, null, null]);
    expect(meta?.days[3].viableSun).toBe(false);
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

  it("clears a day when asked, like the app's own calendar", () => {
    const days = withDayConfirmed([day("2026-07-01", { wentOutside: true })], "2026-07-01", false);
    expect(days[0].wentOutside).toBe(false);
  });

  it("does not invent a row just to clear a day it never had", () => {
    const days = withDayConfirmed([day("2026-07-01")], "2026-07-09", false);
    expect(days).toHaveLength(1);
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
    // Emerald for "you logged sun", the same word the app's calendar uses.
    expect(html).toContain("rgba(16,185,129,0.55)");
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

describe("reading the grid", () => {
  it("splits a date without going through Date or a timezone", () => {
    expect(dayParts("2026-08-01")).toEqual({ day: 1, month: 7 });
    expect(dayParts("2026-12-31")).toEqual({ day: 31, month: 11 });
  });

  it("prints the day number, and the month name where a new month starts", () => {
    expect(cellLabel("2026-07-14", "en")).toBe("14");
    expect(cellLabel("2026-08-01", "en")).toBe("Aug");
    expect(cellLabel("2026-08-01", "es")).toBe("ago");
    expect(cellLabel("2026-08-01", "lt")).toBe("rugp.");
  });
});

describe("the calendar says which days it is showing", () => {
  const meta = {
    authenticated: true,
    days: [
      { date: "2026-07-30", viableSun: true, wentOutside: null },
      { date: "2026-07-31", viableSun: true, wentOutside: true },
      { date: "2026-08-01", viableSun: true, wentOutside: false },
    ] as HistoryDay[],
    streak: 0,
    daysTracked: 3,
  };

  it("numbers every cell", () => {
    const html = renderHistory({ meta, locale: "en" });
    expect(html).toContain(">30</button>");
    expect(html).toContain(">31</button>");
  });

  it("names the month where the grid crosses into it", () => {
    expect(renderHistory({ meta, locale: "es" })).toContain(">ago</button>");
  });

  it("states the range above the grid", () => {
    expect(renderHistory({ meta, locale: "es" })).toContain("30 jul – 1 ago");
  });

  it("hides the number while a tap is in flight, so the pulse reads as pending", () => {
    const html = renderHistory({ meta, pending: ["2026-07-30"], locale: "en" });
    expect(html).toContain("color:transparent");
  });

  it("puts dark ink on the filled cell and light ink on the rest", () => {
    const html = renderHistory({ meta, locale: "en" });
    expect(html).toContain("#04231a");
    expect(html).toContain("rgba(255,255,255,0.86)");
  });

  it("spells out the cycle a tap runs through", () => {
    expect(renderHistory({ meta, locale: "es" }))
      .toContain("saliste → no saliste → sin respuesta");
  });
});

describe("three answers", () => {
  it("cycles unanswered → went out → stayed in → unanswered", () => {
    expect(nextAnswer(null)).toBe(true);
    expect(nextAnswer(true)).toBe(false);
    expect(nextAnswer(false)).toBeNull();
  });

  it("gives each answer its own appearance", () => {
    expect(cellState({ viableSun: true, wentOutside: true })).toBe("confirmed");
    expect(cellState({ viableSun: true, wentOutside: false })).toBe("declined");
    expect(cellState({ viableSun: true, wentOutside: null })).toBe("viable");
    expect(cellState({ viableSun: false, wentOutside: null })).toBe("missed");
  });

  it("never shows 'stayed in' on a day that had no sun to skip", () => {
    // Answering "no" to a day with no window is not a thing the app can produce,
    // and drawing it would imply a choice nobody was offered.
    expect(cellState({ viableSun: false, wentOutside: false })).toBe("missed");
  });

  it("stores the answer it was given, including the explicit no", () => {
    const days = [{ date: "2026-07-01", viableSun: true, wentOutside: null } as HistoryDay];
    expect(withDayConfirmed(days, "2026-07-01", false)[0].wentOutside).toBe(false);
    expect(withDayConfirmed(days, "2026-07-01", null)[0].wentOutside).toBeNull();
  });
});

describe("the legend and what is tappable", () => {
  const meta = {
    authenticated: true,
    days: [
      { date: "2026-07-27", viableSun: true, wentOutside: true },
      { date: "2026-07-28", viableSun: true, wentOutside: false },
      { date: "2026-07-29", viableSun: true, wentOutside: null },
      { date: "2026-07-30", viableSun: false, wentOutside: null },
    ] as HistoryDay[],
    streak: 1,
    daysTracked: 4,
  };

  it("shows a swatch per meaning", () => {
    const html = renderHistory({ meta, locale: "en" });
    const copy = historyStrings("en");
    for (const text of [copy.confirmed, copy.declined, copy.viable, copy.missed]) {
      expect(html, text).toContain(text);
    }
  });

  it("disables the days with no usable sun, as the app does", () => {
    const html = renderHistory({ meta, locale: "en" });
    expect(html).toContain('data-date="2026-07-30" title="2026-07-30');
    expect((html.match(/disabled /g) ?? [])).toHaveLength(1);
    expect((html.match(/cursor:pointer/g) ?? [])).toHaveLength(3);
  });

  it("outlines the 'stayed in' cell instead of colouring it like a miss", () => {
    const html = renderHistory({ meta, locale: "en" });
    expect(html).toContain("inset 0 0 0 1px rgba(255,176,32,0.45)");
  });

  it("translates both new labels everywhere", () => {
    for (const locale of WIDGET_LOCALES) {
      expect(historyStrings(locale).declined.length, locale).toBeGreaterThan(0);
    }
  });
});
