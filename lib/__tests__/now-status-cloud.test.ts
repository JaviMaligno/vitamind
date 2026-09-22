import { describe, it, expect } from "vitest";
import { getCurrentStatus, estimateUVFromElevation, MIN_UVI } from "@/lib/vitd";
import { getCurve } from "@/lib/solar";
import { ozoneDU } from "@/lib/uv-model";
import { doyFromMonthDay } from "@/lib/solar";
import type { WeatherHour } from "@/lib/types";

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * `cloudDegraded` is the difference between two sentences a reader can check
 * against the sky: "the sun is too low today" and "the sun is high enough, the
 * cloud is in the way". It was structurally unreachable — permanently false in
 * BOTH branches of `getCurrentStatus`:
 *
 *   - with weather, it was gated on `!weather`;
 *   - without weather, the "theoretical" hours it compared against were the very
 *     hours the window was derived from (cloud is hardcoded to 0 there, so
 *     `cloudFactor` is a no-op), so the comparison could not differ.
 *
 * The live consequence, reported from London on 2026-09-22: the city page said
 * synthesis was possible until 27 September and the dashboard said "no window
 * today — UV index too low", under a clear-sky peak of UVI 3.4 with Open-Meteo
 * reporting 87% cloud. Both surfaces were right; only one of them said what it
 * actually meant.
 */

const LONDON = { lat: 51.51, lon: -0.13, tz: 0, timezone: "Europe/London", elevation: 11 };

/** Open-Meteo hours for the city's own local day, at a fixed fraction of clear sky. */
function attenuated(curve: { localHours: number; elevation: number }[], ozoneDu: number, factor: number): WeatherHour[] {
  return Array.from({ length: 24 }, (_, h) => {
    const pt = curve.find((p) => Math.floor(p.localHours) === h);
    const clear = estimateUVFromElevation(pt?.elevation ?? 0, { ozoneDu, elevationM: LONDON.elevation });
    return { time: `2026-09-22T${String(h).padStart(2, "0")}:00`, uvIndex: clear * factor, cloudCover: 87 };
  });
}

describe("getCurrentStatus — cloud vs sun", () => {
  const doy = doyFromMonthDay(8, 22); // 22 September
  const ozoneDu = ozoneDU(LONDON.lat, LONDON.lon, doy);
  const curve = getCurve(LONDON.lat, LONDON.lon, doy, LONDON.tz, LONDON.timezone);
  const ctx = { ozoneDu, elevationM: LONDON.elevation };
  // 12:30 BST — inside the clear-sky window, so only the sky can close it.
  const noon = new Date("2026-09-22T11:30:00Z");

  it("reports the window the sun alone allows, independently of the sky", () => {
    const overcast = getCurrentStatus(
      { hours: attenuated(curve, ozoneDu, 0.5) }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx,
    );
    expect(overcast.clearSkyWindow).not.toBeNull();
    // London on 22 September: clear-sky UVI crosses 3 around midday BST.
    expect(overcast.clearSkyWindow!.start).toBeLessThanOrEqual(12);
    expect(overcast.clearSkyWindow!.end).toBeGreaterThan(12);
  });

  it("blames the cloud, not the sun, when the forecast kills a real window", () => {
    const overcast = getCurrentStatus(
      { hours: attenuated(curve, ozoneDu, 0.5) }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx,
    );
    expect(overcast.state).toBe("no_synthesis");
    expect(overcast.window).toBeNull();
    // The regression: this was `false` for every user, on every cloudy day.
    expect(overcast.cloudDegraded).toBe(true);
  });

  it("does not blame the cloud when the forecast agrees there is a window", () => {
    const clear = getCurrentStatus(
      { hours: attenuated(curve, ozoneDu, 1) }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx,
    );
    expect(clear.window).not.toBeNull();
    expect(clear.cloudDegraded).toBe(false);
  });

  it("does not blame the cloud in deep winter, when the sun really is too low", () => {
    const winterDoy = doyFromMonthDay(11, 15); // 15 December
    const winterOzone = ozoneDU(LONDON.lat, LONDON.lon, winterDoy);
    const winterCurve = getCurve(LONDON.lat, LONDON.lon, winterDoy, LONDON.tz, LONDON.timezone);
    const winter = getCurrentStatus(
      { hours: attenuated(winterCurve, winterOzone, 1) },
      winterCurve, 3, 0.25, 1000, null,
      new Date("2026-12-15T12:00:00Z"), LONDON.timezone,
      { ozoneDu: winterOzone, elevationM: LONDON.elevation },
    );
    expect(winter.clearSkyWindow).toBeNull();
    expect(winter.state).toBe("no_synthesis");
    expect(winter.cloudDegraded).toBe(false);
  });

  it("agrees with the clear-sky pages: a cloudy London day still has a solar window", () => {
    // The two claims the reporter saw side by side. They must now be reconcilable
    // from one object rather than only by reading two pages.
    const overcast = getCurrentStatus(
      { hours: attenuated(curve, ozoneDu, 0.5) }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx,
    );
    const peakClearSky = Math.max(
      ...curve.map((p) => estimateUVFromElevation(p.elevation, ctx)),
    );
    expect(peakClearSky).toBeGreaterThanOrEqual(MIN_UVI);
    expect(overcast.clearSkyWindow).not.toBeNull();
    expect(overcast.window).toBeNull();
  });

  it("makes no cloud claim when there is no weather to make it from", () => {
    // Without a forecast the reading IS the clear-sky curve, so there is no gap
    // to attribute to cloud — and claiming one would be inventing weather.
    const noWeather = getCurrentStatus(null, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(noWeather.cloudDegraded).toBe(false);
    expect(noWeather.clearSkyWindow).not.toBeNull();
    expect(noWeather.window).toEqual(noWeather.clearSkyWindow);
  });
});
