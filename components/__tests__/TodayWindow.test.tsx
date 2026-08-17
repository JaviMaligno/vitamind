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

import TodayProvider from "@/components/TodayProvider";
import TodayWindow from "@/components/TodayWindow";
import TodayFaq from "@/components/TodayFaq";
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

const copyAt = (city: City, iso: string) =>
  todayWindowCopy(city.name, sunTodayData(city, cityToday(city, new Date(iso))));

/** The page as the reader gets it: one recomputation feeding both surfaces. */
const hub = (city: City, initial: ReturnType<typeof todayWindowCopy>, year = { q: "y", a: "a" }) => (
  <TodayProvider {...props(city)} initial={initial}>
    <TodayWindow />
    <TodayFaq year={year} />
  </TodayProvider>
);

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

    render(hub(MADRID, stale));

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

    const tokyo = render(hub(TOKYO, copyAt(TOKYO, "2026-08-16T02:00:00Z")));
    expect(tokyo.container.textContent).toMatch(/sunToday\.todayIs.*16 de agosto de 2026/);
    tokyo.unmount();

    const la = render(hub(LA, copyAt(LA, "2026-08-16T02:00:00Z")));
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
    render(hub(MADRID, copyAt(MADRID, "2026-08-16T10:00:00Z")));
    expect(screen.getByText(/sunToday\.clearSky/)).toBeTruthy();
  });
});

/**
 * The failure this exists to make impossible: a stat panel corrected in the
 * browser sitting above an FAQ answer the server rendered months ago. On a
 * regime-flip day (Oslo in mid-September, London in mid-October) that put "no
 * window today" and "between 12:00 and 16:00" on one screen. Both surfaces now
 * read from ONE recomputation in `TodayProvider`, so they cannot disagree.
 */
describe("the panel and the FAQ", () => {
  it("answer the same day even when the cached HTML said the opposite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));

    // Madrid in August has a window; December's cache entry says it has none.
    const december = copyAt(MADRID, "2026-12-16T10:00:00Z");
    expect(december.windowKey).toBe("faqWindowANone");

    const { container } = render(hub(MADRID, december));

    expect(container.textContent).toContain("sunToday.faqWindowASynthesis");
    expect(container.textContent).not.toContain("sunToday.faqWindowANone");
    expect(container.textContent).not.toContain("sunToday.ledeNone");
    expect(screen.queryByText(/sunToday\.noWindowLabel/)).toBeNull();
  });

  it("shows the sun times the browser computed, not the cached ones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));

    const stale = { ...copyAt(MADRID, "2026-08-16T10:00:00Z"), sunrise: "03:00", sunset: "04:00" };
    const fresh = copyAt(MADRID, "2026-08-16T10:00:00Z");
    const { container } = render(hub(MADRID, stale));

    expect(container.textContent).toContain(`"sunrise":"${fresh.sunrise}"`);
    expect(container.textContent).not.toContain("03:00");
  });

  /**
   * The year answer is a property of the place, not of today, so it is the one
   * entry the server renders — and the only one the FAQPage markup carries.
   */
  it("renders the stale-proof year answer exactly as the server wrote it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));
    render(hub(MADRID, copyAt(MADRID, "2026-08-16T10:00:00Z"), { q: "¿Qué meses?", a: "De marzo a octubre." }));
    expect(screen.getByText("¿Qué meses?")).toBeTruthy();
    expect(screen.getByText("De marzo a octubre.")).toBeTruthy();
  });
});
