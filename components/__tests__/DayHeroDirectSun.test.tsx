import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (k: string, values?: Record<string, unknown>) =>
    `${ns}.${k}|${JSON.stringify(values ?? {})}`,
  useLocale: () => "es",
}));
vi.mock("@/hooks/useSolarPhase", () => ({ useSolarPhase: () => "day" }));

import DayHeroBold from "@/components/dashboard/DayHeroBold";
import type { NowStatus } from "@/lib/types";

/** Orvieto, 2026-11-08: inside the clear-sky window, the forecast's cloud closes it. */
const cloudy: NowStatus = {
  state: "no_synthesis", currentUVI: 1.4, effectiveUVI: 1.4, intensity: null,
  minutesNeeded: null, window: null, bestHour: null, bestMinutes: null,
  minutesUntilWindow: null, windowClosesIn: null, cloudCover: 60,
  clearSkyWindow: { start: 11.5, end: 13.2 }, clearSkySource: "forecast", cloudDegraded: true,
  clearSkyNowUVI: 3.4, clearSkyMinutesNow: 38,
};

const hero = (ns: NowStatus) =>
  render(<DayHeroBold nowStatus={ns} cityName="Orvieto" cityFlag="it" targetIU={1000} loading={false} lat={42.7} lon={12.1} />);

describe("DayHeroBold — direct sun under broken cloud", () => {
  it("hides the direct-sun figures until the reader says the sun is on them", () => {
    hero(cloudy);
    const toggle = screen.getByRole("button", { name: /dashboard\.directSunToggle/ });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/dashboard\.directSunBody/)).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/dashboard\.directSunBody/).textContent).toContain('"uvi":"3.4"');

    fireEvent.click(toggle);
    expect(screen.queryByText(/dashboard\.directSunBody/)).toBeNull();
  });

  it("offers nothing when the sun alone would not reach the threshold", () => {
    hero({ ...cloudy, cloudDegraded: false, clearSkyWindow: null, clearSkyNowUVI: 1.6, clearSkyMinutesNow: null });
    expect(screen.queryByRole("button", { name: /dashboard\.directSunToggle/ })).toBeNull();
  });

  it("offers nothing when the forecast already sees a clear sky", () => {
    hero({ ...cloudy, state: "good_now", intensity: "moderate", effectiveUVI: 3.3, cloudDegraded: false, minutesNeeded: 39 });
    expect(screen.queryByRole("button", { name: /dashboard\.directSunToggle/ })).toBeNull();
  });
});
