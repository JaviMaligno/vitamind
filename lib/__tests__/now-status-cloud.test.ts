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
    return {
      time: `2026-09-22T${String(h).padStart(2, "0")}:00`,
      uvIndex: clear * factor,
      // The forecast's own clear-sky reading agrees with the model here, so the
      // calibration is 1:1 and these cases isolate the cloud. The forecast
      // disagreeing with the model is its own test below.
      uvIndexClearSky: clear,
      cloudCover: 87,
    };
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

  it("agrees with the hub about the same day, to within a few minutes", () => {
    /**
     * THE SECOND BUG THIS FILE GUARDS, and it was self-inflicted.
     *
     * The first fix here made the no-weather path read the five-minute curve
     * while the WITH-weather path stayed on Open-Meteo's whole hours. So the hub
     * said London's window was 11:45-14:00 and the dashboard, same city same
     * day, said 12:00-15:00 — two screens of one app contradicting each other,
     * which is the complaint the whole investigation started from.
     *
     * The forecast is still hourly and still decides the numbers. What is read
     * at the curve's resolution is the ATTENUATION between its readings, which
     * is the slowly-varying part; the sun's position was never uncertain.
     */
    const transmission = 0.98; // a near-clear sky, so the two should nearly coincide
    const w = { hours: attenuated(curve, ozoneDu, transmission) };
    const live = getCurrentStatus(w, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(live.window).not.toBeNull();
    expect(live.clearSkyWindow).not.toBeNull();
    // Within one sampling step of the clear-sky window the hub publishes.
    expect(Math.abs(live.window!.start - live.clearSkyWindow!.start) * 60).toBeLessThanOrEqual(10);
    expect(Math.abs(live.window!.end - live.clearSkyWindow!.end) * 60).toBeLessThanOrEqual(10);
    // And not snapped to the hour.
    expect(Number.isInteger(live.window!.start) && Number.isInteger(live.window!.end)).toBe(false);
  });

  it("keeps the forecast's own values — the curve only supplies the shape", () => {
    // Halve the sky's transmission and the window must shrink, not merely shift:
    // the ratio is what carries Open-Meteo's numbers through.
    const clear = getCurrentStatus({ hours: attenuated(curve, ozoneDu, 1) }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    const hazy = getCurrentStatus({ hours: attenuated(curve, ozoneDu, 0.92) }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(clear.window).not.toBeNull();
    expect(hazy.window).not.toBeNull();
    const span = (w: { start: number; end: number }) => w.end - w.start;
    expect(span(hazy.window!)).toBeLessThan(span(clear.window!));
  });

  it("takes the clear-sky reference from the forecast when it supplies one", () => {
    /**
     * THE THIRD THING THIS FILE GUARDS: which model is allowed to say what the
     * sun alone would do.
     *
     * `cloudDegraded` is a comparison, and it used to compare Open-Meteo's
     * cloudy number against OUR clear-sky number. Those come from two different
     * models on two different ozone fields — ours a 1979 climatology with no
     * day-to-day term — and they disagree by up to a factor of two
     * (docs/uv-sources.md). Every bit of that disagreement was being reported as
     * cloud.
     *
     * Open-Meteo publishes `uv_index_clear_sky` in the same response. Here it
     * says the clear sky is worth 40% more than our model thinks, with no cloud
     * at all: the honest answer is a WIDER window than the model alone would
     * give, and no cloud claim, because nothing is being blocked.
     */
    const hours = attenuated(curve, ozoneDu, 1).map((h) => ({
      ...h,
      uvIndex: h.uvIndex * 1.4,
      uvIndexClearSky: h.uvIndex * 1.4,
      cloudCover: 0,
    }));
    const live = getCurrentStatus({ hours }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(live.clearSkySource).toBe("forecast");
    expect(live.cloudDegraded).toBe(false);

    const modelOnly = getCurrentStatus(null, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(modelOnly.clearSkySource).toBe("model");
    // A stronger sun reaches the threshold earlier and holds it later.
    expect(live.clearSkyWindow!.start).toBeLessThan(modelOnly.clearSkyWindow!.start);
    expect(live.clearSkyWindow!.end).toBeGreaterThan(modelOnly.clearSkyWindow!.end);
  });

  it("measures cloud against the forecast's own clear sky, not against ours", () => {
    // Same 40% disagreement between the models, now with real cloud on top:
    // half of that stronger clear sky gets through. The transmission is 0.5 and
    // must be read as 0.5 — if our model were still the denominator it would
    // read as 0.7 and the day would look sunnier than the forecast says.
    const hours = attenuated(curve, ozoneDu, 1).map((h) => ({
      ...h,
      uvIndexClearSky: h.uvIndex * 1.4,
      uvIndex: h.uvIndex * 1.4 * 0.5,
      cloudCover: 70,
    }));
    const live = getCurrentStatus({ hours }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(live.clearSkySource).toBe("forecast");
    // Half of a clear sky that peaks near 4.7 is about 2.4 — under the threshold
    // all day, so the window is gone and the cloud is what took it.
    expect(live.window).toBeNull();
    expect(live.clearSkyWindow).not.toBeNull();
    expect(live.cloudDegraded).toBe(true);
  });

  it("falls back to the model when the forecast omits the clear-sky field", () => {
    // The archive host carries no UV at all, and the field is young; a caller
    // must not be left without a reference just because one is missing.
    const hours = attenuated(curve, ozoneDu, 0.5).map((h) => ({ ...h, uvIndexClearSky: null }));
    const live = getCurrentStatus({ hours }, curve, 3, 0.25, 1000, null, noon, LONDON.timezone, ctx);
    expect(live.clearSkySource).toBe("model");
    expect(live.clearSkyWindow).not.toBeNull();
    expect(live.cloudDegraded).toBe(true);
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
