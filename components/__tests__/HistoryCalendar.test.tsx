import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import HistoryCalendar, { type LocationSpan } from "@/components/dashboard/HistoryCalendar";
import fullMessages from "@/messages/es.json";
import { pickClientMessages } from "@/i18n/client-messages";
import type { DayRecord } from "@/lib/types";

vi.mock("@/components/PartnerBadge", () => ({ default: () => null }));

/**
 * The provider gets the SAME subset the real layout ships, not the whole
 * messages file. Passing `fullMessages` here made this test pass on namespaces
 * the browser does not receive, so it could not have caught the filter dropping
 * one — and next-intl does not throw on a miss, it renders the literal key path.
 * `onError` closes the remaining gap: without it a missing message would only
 * console.error and this test would assert against a key path as if it were
 * copy.
 */
const messages = pickClientMessages(fullMessages);
const throwOnMissing = (error: unknown) => {
  throw error;
};

const day = (date: string, over: Partial<DayRecord> = {}): DayRecord => ({
  date, cityId: "gps:51.56,-0.10", peakUVI: 6, windowStart: 11, windowEnd: 17,
  minutesNeeded: 10, sufficient: true, userOverride: null, ...over,
});

/** The week the calendar opens on, so the assertions are about visible cells. */
function thisWeek(): string[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

const draw = (records: DayRecord[], locations: LocationSpan[] = [], assumedDates: string[] = []) =>
  render(
    <NextIntlClientProvider locale="es" messages={messages} onError={throwOnMissing}>
      <HistoryCalendar
        records={records}
        locations={locations}
        assumedDates={assumedDates}
        onToggleOverride={() => {}}
      />
    </NextIntlClientProvider>,
  );

describe("HistoryCalendar location line", () => {
  const week = thisWeek();

  it("names the stretches under the grid", () => {
    draw(week.map((d) => day(d)), [
      { name: "Londres", cityId: "gps:51.56,-0.10", from: week[0], to: week[6], days: 7, assumedDays: 0 },
    ]);
    expect(screen.getByText(/Londres/)).toBeTruthy();
  });

  it("stays quiet when nothing was inherited", () => {
    // Someone who opens the app daily has nothing to correct; a permanent
    // caveat would describe a problem they do not have.
    draw(week.map((d) => day(d)), [
      { name: "Londres", cityId: "gps:51.56,-0.10", from: week[0], to: week[6], days: 7, assumedDays: 0 },
    ], []);
    expect(screen.queryByText(/no se registraron/)).toBeNull();
  });

  it("counts inherited days inside the view, not across the whole stretch", () => {
    // The bug this replaces: a 90-day stretch clipped to a week reported the
    // whole week as inherited, even where every day had been recorded.
    draw(week.map((d) => day(d)), [
      { name: "Londres", cityId: "gps:51.56,-0.10", from: "2026-05-01", to: week[6], days: 90, assumedDays: 83 },
    ], [week[5], week[6]]);
    expect(screen.getByText(/2 de 7 días no se registraron/)).toBeTruthy();
  });

  /**
   * The one per-cell mark worth drawing: a single day in a different place from
   * the stretches either side of it. The widget in the chat has had it since it
   * shipped; the app is the other half of the same answer.
   */
  it("marks the day that breaks its stretch, and only it", () => {
    const spans: LocationSpan[] = [
      { name: "Londres", cityId: "gps:51.56,-0.10", from: week[0], to: week[2], days: 3, assumedDays: 0 },
      { name: "Valencia", cityId: "builtin:valencia", from: week[3], to: week[3], days: 1, assumedDays: 0 },
      { name: "Londres", cityId: "gps:51.56,-0.10", from: week[4], to: week[6], days: 3, assumedDays: 0 },
    ];
    const { container } = draw(week.map((d) => day(d)), spans);
    const marked = container.querySelectorAll("[data-odd-one]");
    expect(marked).toHaveLength(1);
    // Named in the label, because a dot nobody can read is decoration.
    expect(marked[0].getAttribute("aria-label")).toContain("Valencia");
  });

  it("marks nothing when the day merely starts a new stretch", () => {
    const moved: LocationSpan[] = [
      { name: "Londres", cityId: "gps:51.56,-0.10", from: week[0], to: week[2], days: 3, assumedDays: 0 },
      { name: "Valencia", cityId: "builtin:valencia", from: week[3], to: week[6], days: 4, assumedDays: 0 },
    ];
    const { container } = draw(week.map((d) => day(d)), moved);
    expect(container.querySelectorAll("[data-odd-one]")).toHaveLength(0);
  });
});
