"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cityToday, sunTodayData, todayWindowCopy, type TodayWindowCopy } from "@/lib/sun-today";
import { zonedDate } from "@/lib/timezone";
import type { City } from "@/lib/types";

/**
 * ONE recomputation of today, shared by every day-dependent surface on the hub.
 *
 * The page is served from the ISR cache and that cache has no upper bound on
 * its age: after `revalidate` elapses the next request is handed the STALE copy
 * while regeneration happens behind it, so a URL nobody has asked for in a
 * month answers with a month-old render. Across a month a city's window does
 * not merely shift — it can vanish (Oslo between August and September) or
 * appear. So the server's figures are a starting point, not the answer, and the
 * browser recomputes them from the CITY's own calendar date on mount.
 *
 * Why a provider rather than a hook per component: the stat panel and the FAQ
 * are far apart in the tree with server-rendered sections between them. Two
 * independent recomputations would be two chances to disagree, and a panel
 * reading "no window today" above an answer reading "between 12:00 and 16:00"
 * is worse than either alone. There is exactly one state here, so that screen
 * cannot be produced.
 *
 * The first client render deliberately reproduces `initial` exactly (the state
 * is filled in an effect, not during render), so hydration has nothing to
 * mismatch on. See lib/sun-today.ts for the whole freshness argument.
 */

export interface TodayState {
  /** The live figures once the effect has run, the server's until then. */
  shown: TodayWindowCopy;
  /**
   * The city's own calendar date, formatted in the page's locale — null until
   * the browser has computed it. The server never names a date.
   */
  date: string | null;
  cityName: string;
  city: Pick<City, "lat" | "lon" | "tz" | "timezone" | "elevation">;
}

const Ctx = createContext<TodayState | null>(null);

export function useToday(): TodayState {
  const state = useContext(Ctx);
  if (!state) throw new Error("useToday must be used inside TodayProvider");
  return state;
}

interface Props {
  city: Pick<City, "lat" | "lon" | "tz" | "timezone" | "elevation">;
  cityName: string;
  /** What the server rendered, so the HTML a crawler reads is not empty. */
  initial: TodayWindowCopy;
  children: React.ReactNode;
}

export default function TodayProvider({ city, cityName, initial, children }: Props) {
  const locale = useLocale();
  const [live, setLive] = useState<{ copy: TodayWindowCopy; date: string } | null>(null);

  const { lat, lon, tz, timezone, elevation } = city;

  useEffect(() => {
    function compute() {
      const now = new Date();
      const full: City = {
        id: "today", name: cityName, lat, lon, tz, timezone, elevation, source: "builtin",
      };
      const today = cityToday(full, now);
      // The REAL year, read in the city's zone — unlike the sun figures, which
      // are pinned to the reference year the whole site computes in. A date
      // label is the one thing here that must be literally today's.
      const { year, monthIndex, day } = zonedDate(now, timezone, tz);
      const date = new Intl.DateTimeFormat(locale, {
        weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      }).format(new Date(Date.UTC(year, monthIndex, day)));
      setLive({ copy: todayWindowCopy(cityName, sunTodayData(full, today)), date });
    }
    compute();
    // Timers freeze while a PWA is backgrounded, so a tab left open overnight
    // needs the visibility hook as well as the interval — the same pair
    // SunTimesPanel uses. Ten minutes is enough for a value that changes once a
    // day; the window itself is quantised to whole hours.
    const id = setInterval(compute, 600_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") compute();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [lat, lon, tz, timezone, elevation, cityName, locale]);

  return (
    <Ctx.Provider value={{ shown: live?.copy ?? initial, date: live?.date ?? null, cityName, city }}>
      {children}
    </Ctx.Provider>
  );
}
