"use client";

import { useTranslations } from "next-intl";
import PhaseWindow from "@/components/PhaseWindow";
import { useToday } from "@/components/TodayProvider";

/**
 * The lede and the stat panel: today's vitamin D window, corrected in the
 * browser.
 *
 * All of its day-dependent state comes from `TodayProvider`, which is also what
 * `TodayFaq` reads further down the page — see that file for why the
 * recomputation is shared rather than repeated.
 */

export default function TodayWindow() {
  const t = useTranslations("sunToday");
  const tSun = useTranslations("sunTimes");
  const { shown, date, cityName, city } = useToday();

  return (
    <>
      <p className="mt-4 text-body sm:text-heading text-text-secondary max-w-2xl leading-relaxed">
        {t(shown.ledeKey, shown.values)}
      </p>

      <PhaseWindow lat={city.lat} lon={city.lon} className="mt-8 p-5 sm:p-6 text-on-window">
        {date && (
          <p className="text-caption uppercase tracking-wider opacity-70">
            {t("todayIs", { date })}
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
        {date && <p className="mt-1 text-caption opacity-70">{t("recomputed", { city: cityName })}</p>}
      </PhaseWindow>
    </>
  );
}
