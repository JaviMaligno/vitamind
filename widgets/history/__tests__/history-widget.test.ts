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

/**
 * Where you were is a different question from how the day went, so it sits under
 * the grid rather than inside it. It also cannot be a per-cell dot: on real data
 * 18 of 30 days inherit their location, and a mark on 60% of the squares reads
 * as texture. Spans are three or four.
 */
describe("where you were", () => {
  const withSpans = (locations: unknown, over: Record<string, unknown> = {}) =>
    readHistoryMeta(wrap({
      authenticated: true, from: "2026-07-04", to: "2026-08-02", streak: 0, daysTracked: 3,
      days: [day("2026-07-13", { wentOutside: true })],
      locations, ...over,
    }));

  const SPANS = [
    { name: "Londres", from: "2026-07-04", to: "2026-07-19", days: 16, assumedDays: 9 },
    { name: "Valencia", from: "2026-07-20", to: "2026-07-20", days: 1, assumedDays: 0 },
    { name: "Londres", from: "2026-07-21", to: "2026-08-02", days: 13, assumedDays: 9 },
  ];

  it("names every stretch, with its dates", () => {
    const html = renderHistory({ meta: withSpans(SPANS), locale: "es" });
    expect(html).toContain("Londres");
    expect(html).toContain("Valencia");
    // Dates spelled out rather than implied by the width of a bar: a one-day
    // stretch in a proportional strip collapses into an unreadable sliver.
    expect(html).toContain("20 jul");
  });

  it("names the month once when the stretch does not leave it", () => {
    const html = renderHistory({ meta: withSpans(SPANS), locale: "es" });
    expect(html).toContain("4 – 19 jul");
    expect(html).not.toContain("4 jul – 19 jul");
    // Across a month boundary both are named, or the range is ambiguous.
    expect(html).toContain("21 jul – 2 ago");
  });

  it("says how many days were inherited, and how many there are", () => {
    const html = renderHistory({ meta: withSpans(SPANS), locale: "es" });
    expect(html).toContain("18");
    expect(html).toContain("30");
    expect(html).not.toContain("{assumed}");
  });

  it("makes each stretch tappable so it can be corrected", () => {
    const html = renderHistory({ meta: withSpans(SPANS), locale: "es" });
    expect(html).toContain('data-span-from="2026-07-21"');
    expect(html).toContain('data-span-to="2026-08-02"');
  });

  it("prints nothing at all when the payload has no stretches", () => {
    // Older clients, and the signed-out path. An empty heading is worse than none.
    const html = renderHistory({ meta: withSpans([]), locale: "es" });
    expect(html).not.toContain(historyStrings("es").whereLabel);
  });

  it("stays quiet when nothing was inherited", () => {
    // Someone who opens the app daily has nothing to correct; the note would be
    // a permanent caveat about a problem they do not have.
    const solid = [{ name: "Madrid", from: "2026-07-04", to: "2026-08-02", days: 30, assumedDays: 0 }];
    const html = renderHistory({ meta: withSpans(solid), locale: "es" });
    expect(html).toContain("Madrid");
    expect(html).not.toContain(historyStrings("es").assumedNote.slice(0, 12));
  });

  it("drops a nameless stretch rather than leaving a hole", () => {
    const meta = withSpans([{ name: "", from: "2026-07-04", to: "2026-07-10" }, SPANS[1]]);
    expect(meta?.locations).toHaveLength(1);
  });

  it("has the copy in every language, with no unfilled placeholders", () => {
    for (const locale of WIDGET_LOCALES) {
      const copy = historyStrings(locale);
      expect(copy.whereLabel.length, locale).toBeGreaterThan(0);
      expect(copy.assumedNote, locale).toContain("{assumed}");
      expect(renderHistory({ meta: withSpans(SPANS), locale }), locale).not.toContain("{total}");
    }
  });
});

/**
 * The one place a per-cell mark earns its keep: a single day sitting in a
 * different place from the stretches on both sides of it. On real data that is
 * one square in thirty — checking Valencia once during a London fortnight —
 * so it reads as an exception rather than as texture.
 */
describe("the day that breaks its stretch", () => {
  const build = (locations: unknown) => readHistoryMeta(wrap({
    authenticated: true, from: "2026-07-18", to: "2026-07-22", streak: 0, daysTracked: 1,
    days: ["2026-07-18", "2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22"].map((d) => day(d)),
    locations,
  }));

  const SANDWICHED = [
    { name: "Londres", from: "2026-07-18", to: "2026-07-19", days: 2, assumedDays: 0 },
    { name: "Valencia", from: "2026-07-20", to: "2026-07-20", days: 1, assumedDays: 0 },
    { name: "Londres", from: "2026-07-21", to: "2026-07-22", days: 2, assumedDays: 2 },
  ];

  const cellFor = (html: string, date: string) => {
    const at = html.indexOf(`data-date="${date}"`);
    return html.slice(at, html.indexOf("</button>", at));
  };

  it("marks it, and only it", () => {
    const html = renderHistory({ meta: build(SANDWICHED), locale: "es" });
    expect(cellFor(html, "2026-07-20")).toContain("data-odd-one");
    for (const other of ["2026-07-18", "2026-07-19", "2026-07-21", "2026-07-22"]) {
      expect(cellFor(html, other), other).not.toContain("data-odd-one");
    }
  });

  it("names the place in the cell's own label, so the mark is legible", () => {
    const html = renderHistory({ meta: build(SANDWICHED), locale: "es" });
    expect(cellFor(html, "2026-07-20")).toContain("Valencia");
  });

  it("says nothing when the day merely starts a new stretch", () => {
    // Moving house is not an anomaly; it only counts when the same place
    // resumes straight after.
    const moved = [
      { name: "Londres", from: "2026-07-18", to: "2026-07-19", days: 2, assumedDays: 0 },
      { name: "Valencia", from: "2026-07-20", to: "2026-07-22", days: 3, assumedDays: 2 },
    ];
    expect(renderHistory({ meta: build(moved), locale: "es" })).not.toContain("data-odd-one");
  });

  it("says nothing when a lone day sits at either end", () => {
    // Nothing before it to disagree with.
    const atEdge = [
      { name: "Valencia", from: "2026-07-18", to: "2026-07-18", days: 1, assumedDays: 0 },
      { name: "Londres", from: "2026-07-19", to: "2026-07-22", days: 4, assumedDays: 3 },
    ];
    expect(renderHistory({ meta: build(atEdge), locale: "es" })).not.toContain("data-odd-one");
  });
});
