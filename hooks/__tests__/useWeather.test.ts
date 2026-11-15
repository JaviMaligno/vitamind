import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWeather } from "../useWeather";
import { getCachedWeather } from "@/lib/storage";

vi.mock("@/lib/storage", () => ({ getCachedWeather: vi.fn(), setCachedWeather: vi.fn() }));

const weather = { hours: [{ time: "2026-11-14T12:00", uvIndex: 3, uvIndexClearSky: 4, cloudCover: 10 }] };
const date = (day: string) => new Date(`${day}T12:00:00`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T16:43:00Z"));
  vi.mocked(getCachedWeather).mockReturnValue(null);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(weather))));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SPEC-4: Explore weather horizon (incident #88)", () => {
  it("uses the existing model fallback for dates beyond the forecast horizon without fetching", () => {
    const { result } = renderHook(() => useWeather(40.42, -3.7, date("2026-12-01")));
    expect(result.current).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["2026-11-14", "2026-11-29", "2026-07-16"])("preserves weather fetching for supported date %s", async (day) => {
    const { result } = renderHook(() => useWeather(40.42, -3.7, date(day)));
    await waitFor(() => expect(result.current?.hours).toEqual(weather.hours));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("drops loaded weather immediately when switching outside the horizon and can fetch again", async () => {
    const { result, rerender } = renderHook(({ day }) => useWeather(40.42, -3.7, date(day)), {
      initialProps: { day: "2026-11-14" },
    });
    await waitFor(() => expect(result.current?.hours).toEqual(weather.hours));
    rerender({ day: "2026-12-01" });
    expect(result.current).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    rerender({ day: "2026-11-15" });
    await waitFor(() => expect(result.current?.hours).toEqual(weather.hours));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not use cached weather for an unsupported future date", () => {
    vi.mocked(getCachedWeather).mockReturnValue({ ...weather, fetchedAt: Date.now() });
    const { result } = renderHook(() => useWeather(40.42, -3.7, date("2026-12-01")));
    expect(result.current).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("aborts an in-flight valid-date request and ignores its late result after switching outside the horizon", async () => {
    let resolveOld!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ day }) => useWeather(40.42, -3.7, date(day)), {
      initialProps: { day: "2026-11-14" },
    });
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    rerender({ day: "2026-12-01" });
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolveOld(new Response(JSON.stringify(weather))); });
    expect(result.current).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    rerender({ day: "2026-11-15" });
    await waitFor(() => expect(result.current?.hours).toEqual(weather.hours));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
