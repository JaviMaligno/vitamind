import { describe, expect, it } from "vitest";
import { readHistoryMeta, withDayConfirmed, nextAnswer, HISTORY_META_KEY, type HistoryDay } from "../data";
import { renderHistory, weekdayIndex, cellLabel, dayParts, cellState } from "../render";
import { historyStrings, WIDGET_LOCALES } from "../i18n";

const wrap = (payload: unknown) => ({ content: [], _meta: { [HISTORY_META_KEY]: payload } });

// Default answer is null, not false: with three states, false stopped meaning
// "unconfirmed" and started meaning "had sun and stayed in".
const day = (date: string, over: Partial<HistoryDay> = {}): HistoryDay =>
  ({ date, viableSun: true, wentOutside: null, known: true, ...over });

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
    expect(days[1]).toEqual({ date: "2026-07-05", viableSun: false, wentOutside: true, known: true });
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

/**
 * The grid chained records together instead of laying them on a calendar. A
 * profile with gaps — the normal shape, since records only exist for days the
 * app was opened — drew 30 squares for a span of 104 days, so it read as a
 * single month, and every column after the first gap sat under the wrong
 * weekday. `from`/`to` now come from the tool, and the grid is drawn from them.
 */
describe("the grid is a calendar, not a strip of records", () => {
  const sparse = {
    authenticated: true,
    // Two bursts a fortnight apart, and nothing since.
    days: [day("2026-07-13"), day("2026-07-14", { wentOutside: true }), day("2026-07-27")],
    streak: 0,
    daysTracked: 3,
    from: "2026-07-03",
    to: "2026-08-01",
  };

  const cellDates = (html: string) => [...html.matchAll(/data-date="([\d-]+)"/g)].map((m) => m[1]);

  it("carries the window through from the payload", () => {
    const meta = readHistoryMeta(wrap(sparse));
    expect(meta?.from).toBe("2026-07-03");
    expect(meta?.to).toBe("2026-08-01");
  });

  it("draws every day in the window, not just the logged ones", () => {
    const html = renderHistory({ meta: readHistoryMeta(wrap(sparse)), locale: "es" });
    const dates = cellDates(html);
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-07-03");
    expect(dates[dates.length - 1]).toBe("2026-08-01");
  });

  it("keeps the columns honest across a gap", () => {
    // 3 July 2026 is a Friday, so it sits in column 4 (Mon = 0). Every later
    // cell must land on its own weekday; before the fix they slid left by the
    // size of each gap.
    const html = renderHistory({ meta: readHistoryMeta(wrap(sparse)), locale: "es" });
    const leadBlanks = (html.match(/<span><\/span>/g) ?? []).length;
    expect(leadBlanks).toBe(4);
    const dates = cellDates(html);
    for (const [i, date] of dates.entries()) {
      expect((leadBlanks + i) % 7, `${date} is in the wrong column`).toBe(weekdayIndex(date));
    }
  });

  it("reaches today even though today has no record", () => {
    // The first place anyone looks. Before the fix the grid stopped at the last
    // logged day and today was simply absent.
    const html = renderHistory({ meta: readHistoryMeta(wrap(sparse)), locale: "es" });
    expect(html).toContain('data-date="2026-08-01"');
  });

  it("spells the window from the range, not from the first and last record", () => {
    const html = renderHistory({ meta: readHistoryMeta(wrap(sparse)), locale: "es" });
    expect(html).toContain("3 jul");
    expect(html).toContain("1 ago");
  });

  it("leaves a day with no record unanswerable", () => {
    const html = renderHistory({ meta: readHistoryMeta(wrap(sparse)), locale: "es" });
    const today = html.slice(html.indexOf('data-date="2026-08-01"'));
    expect(today.slice(0, 400)).toContain("disabled");
  });

  it("still works for a payload with no window, drawing first to last", () => {
    // Older clients, and the frozen-payload path.
    const meta = readHistoryMeta(wrap({ ...sparse, from: undefined, to: undefined }));
    const dates = cellDates(renderHistory({ meta, locale: "es" }));
    expect(dates[0]).toBe("2026-07-13");
    expect(dates[dates.length - 1]).toBe("2026-07-27");
    expect(dates).toHaveLength(15);
  });
});

/**
 * The server now works out every day in the span, so a day nobody logged still
 * has a verdict. What is left for `unlogged` is the narrow case where the day
 * could not be placed at all — no location anywhere in the history — and there
 * genuinely is nothing to say about its sun.
 */
describe("a day that could not be placed says nothing", () => {
  const meta = readHistoryMeta(wrap({
    authenticated: true,
    days: [
      { date: "2026-07-13", viableSun: true, wentOutside: true, known: true },
      // Derived by the server: nobody logged it, but the sun is known.
      { date: "2026-07-14", viableSun: true, wentOutside: null, known: true },
      // Genuinely unplaceable.
      { date: "2026-07-15", viableSun: false, wentOutside: null, known: false },
      { date: "2026-07-16", viableSun: false, wentOutside: null, known: true },
    ],
    streak: 1, daysTracked: 1,
    from: "2026-07-13", to: "2026-07-16",
  }));

  /** Just that day's button — a fixed slice spills into the next cell. */
  const cellFor = (html: string, date: string) => {
    const at = html.indexOf(`data-date="${date}"`);
    return html.slice(at, html.indexOf("</button>", at));
  };

  it("draws it apart from a day that genuinely had no sun", () => {
    const html = renderHistory({ meta, locale: "es" });
    const unplaceable = cellFor(html, "2026-07-15").match(/background:([^;]+)/)?.[1];
    const noSun = cellFor(html, "2026-07-16").match(/background:([^;]+)/)?.[1];
    expect(unplaceable).not.toBe(noSun);
  });

  it("labels it as unknown rather than as a verdict", () => {
    const html = renderHistory({ meta, locale: "es" });
    expect(cellFor(html, "2026-07-15")).toContain(historyStrings("es").unlogged);
    expect(cellFor(html, "2026-07-15")).not.toContain(historyStrings("es").missed);
  });

  it("gives an unanswered day with sun its amber cell back", () => {
    // This is the change: it used to be drawn as "no data" because no record
    // existed. The sun that day is knowable, so it reads as a day you could
    // still answer for.
    const html = renderHistory({ meta, locale: "es" });
    const cell = cellFor(html, "2026-07-14");
    expect(cell).toContain(historyStrings("es").viable);
    expect(cell).not.toContain("disabled");
  });

  it("cannot be tapped — there is nothing to answer about", () => {
    expect(cellFor(renderHistory({ meta, locale: "es" }), "2026-07-15")).toContain("disabled");
  });

  it("names the state in every language", () => {
    for (const locale of WIDGET_LOCALES) {
      expect(historyStrings(locale).unlogged.length, locale).toBeGreaterThan(0);
    }
  });
});
