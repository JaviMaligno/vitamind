"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PhaseWindow from "@/components/PhaseWindow";
import { cityToday, sunTodayData, todayWindowCopy, type TodayWindowCopy } from "@/lib/sun-today";
import { zonedDate } from "@/lib/timezone";
import type { City } from "@/lib/types";

/**
 * Today's vitamin D window, corrected in the browser.
 *
 * The page is served from the ISR cache, and ISR gives no upper bound on how
 * old that cache is: after `revalidate` elapses the next request is handed the
 * STALE copy while regeneration happens behind it. So the server's figures are
 * treated as a starting point, not as the answer — this component recomputes
 * them from the CITY's own calendar date the moment it mounts, and only then
 * does the page name a date at all.
 *
 * The first client render deliberately reproduces `initial` exactly (the state
 * is filled in an effect, not during render), so hydration has nothing to
 * mismatch on. See lib/sun-today.ts for the whole freshness argument.
 */

interface Props {
  city: Pick<City, "lat" | "lon" | "tz" | "timezone" | "elevation">;
  cityName: string;
  /** What the server rendered, so the HTML a crawler reads is not empty. */
  initial: TodayWindowCopy;
}

interface Live extends TodayWindowCopy {
  /** The city's own calendar date, formatted in the page's locale. */
  date: string;
}

export default function TodayWindow({ city, cityName, initial }: Props) {
  const t = useTranslations("sunToday");
  const tSun = useTranslations("sunTimes");
  const locale = useLocale();
  const [live, setLive] = useState<Live | null>(null);

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
      setLive({ ...todayWindowCopy(cityName, sunTodayData(full, today)), date });
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

  const shown = live ?? initial;

  return (
    <>
      <p className="mt-4 text-body sm:text-heading text-text-secondary max-w-2xl leading-relaxed">
        {t(shown.ledeKey, shown.values)}
      </p>

      <PhaseWindow lat={lat} lon={lon} className="mt-8 p-5 sm:p-6 text-on-window">
        {live && (
          <p className="text-caption uppercase tracking-wider opacity-70">
            {t("todayIs", { date: live.date })}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{t("windowLabel")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold whitespace-nowrap">
              {shown.windowStart && shown.windowEnd
                ? `${shown.windowStart}–${shown.windowEnd}`
                : t("noWindowLabel")}
            </span>
          </div>
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{t("minutesLabel")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold whitespace-nowrap">
              {shown.minutes !== null ? t("minutesValue", { minutes: shown.minutes }) : "—"}
            </span>
          </div>
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{tSun("sunrise")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold">{shown.sunrise ?? "—"}</span>
          </div>
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{tSun("sunset")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold">{shown.sunset ?? "—"}</span>
          </div>
        </div>
        <p className="mt-4 text-caption opacity-70">{t("clearSky")}</p>
        {live && <p className="mt-1 text-caption opacity-70">{t("recomputed", { city: cityName })}</p>}
      </PhaseWindow>
    </>
  );
}
