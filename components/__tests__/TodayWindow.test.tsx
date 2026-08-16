import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The values matter here (the date and the window figures are what is being
// tested), so the stub renders them alongside the key.
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (k: string, values?: Record<string, unknown>) =>
    `${ns}.${k}|${JSON.stringify(values ?? {})}`,
  useLocale: () => "es",
}));
// PhaseWindow tints itself from the live solar phase on a timer; it is scenery
// for this test and its clock would fight the fake one.
vi.mock("@/components/PhaseWindow", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import TodayWindow from "@/components/TodayWindow";
import { cityToday, sunTodayData, todayWindowCopy } from "@/lib/sun-today";
import type { City } from "@/lib/types";

const MADRID: City = {
  id: "builtin:madrid", name: "Madrid", lat: 40.4168, lon: -3.7038, tz: 1,
  timezone: "Europe/Madrid", elevation: 667, source: "builtin",
};
const TOKYO: City = {
  id: "builtin:tokio", name: "Tokio", lat: 35.6762, lon: 139.6503, tz: 9,
  timezone: "Asia/Tokyo", elevation: 40, source: "builtin",
};
const LA: City = {
  id: "builtin:los-angeles", name: "Los Angeles", lat: 34.0522, lon: -118.2437, tz: -8,
  timezone: "America/Los_Angeles", elevation: 93, source: "builtin",
};

const props = (city: City) => ({
  city: { lat: city.lat, lon: city.lon, tz: city.tz, timezone: city.timezone, elevation: city.elevation },
  cityName: city.name,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TodayWindow", () => {
  /**
   * The whole point of the component. The server's HTML can come from an ISR
   * cache of unbounded age, so whatever it rendered is a starting point: the
   * reader must see figures computed for the day they are actually reading on.
   */
  it("replaces the cached server figures with ones computed on mount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));

    // A deliberately wrong window, as a months-old cache entry would carry.
    const stale = {
      ...todayWindowCopy("Madrid", sunTodayData(MADRID, cityToday(MADRID, new Date("2026-08-16T10:00:00Z")))),
      windowStart: "05:00",
      windowEnd: "06:00",
      minutes: 999,
    };
    const fresh = todayWindowCopy("Madrid", sunTodayData(MADRID, cityToday(MADRID, new Date("2026-08-16T10:00:00Z"))));

    render(<TodayWindow {...props(MADRID)} initial={stale} />);

    expect(screen.queryByText("05:00–06:00")).toBeNull();
    expect(screen.getByText(`${fresh.windowStart}–${fresh.windowEnd}`)).toBeTruthy();
    expect(screen.getByText(/sunToday\.minutesValue.*"minutes":\d+/)).toBeTruthy();
  });

  /**
   * "Today" is a different date in Tokyo and in Los Angeles at the same
   * instant, and the reader may be in neither. The date shown is the CITY's.
   */
  it("names the date in the city's own zone, not the reader's", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T02:00:00Z"));

    const tokyo = render(
      <TodayWindow {...props(TOKYO)} initial={todayWindowCopy("Tokio", sunTodayData(TOKYO, cityToday(TOKYO)))} />,
    );
    expect(tokyo.container.textContent).toMatch(/sunToday\.todayIs.*16 de agosto de 2026/);
    tokyo.unmount();

    const la = render(
      <TodayWindow {...props(LA)} initial={todayWindowCopy("Los Angeles", sunTodayData(LA, cityToday(LA)))} />,
    );
    expect(la.container.textContent).toMatch(/sunToday\.todayIs.*15 de agosto de 2026/);
  });

  /**
   * Before the effect runs there is no date on the page at all — the server
   * renders no calendar date, and the component must not invent one for the
   * hydration render either.
   */
  it("carries the clear-sky caveat beside every figure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));
    render(
      <TodayWindow {...props(MADRID)} initial={todayWindowCopy("Madrid", sunTodayData(MADRID, cityToday(MADRID)))} />,
    );
    expect(screen.getByText(/sunToday\.clearSky/)).toBeTruthy();
  });
});
