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

  const stats = [
    {
      label: t("windowLabel"),
      value: shown.windowStart && shown.windowEnd
        ? `${shown.windowStart}\u2013${shown.windowEnd}`
        : t("noWindowLabel"),
    },
    {
      label: t("minutesLabel"),
      value: shown.minutes !== null ? t("minutesValue", { minutes: shown.minutes }) : "\u2014",
    },
    { label: tSun("sunrise"), value: shown.sunrise ?? "\u2014" },
    { label: tSun("sunset"), value: shown.sunset ?? "\u2014" },
  ];

  return (
    <>
      <p className="mt-4 text-body sm:text-heading text-text-secondary max-w-2xl leading-relaxed">
        {t(shown.ledeKey, shown.values)}
      </p>

      <PhaseWindow lat={city.lat} lon={city.lon} className="mt-8 p-6 sm:p-8 text-on-window">
        {date && (
          <p className="text-caption uppercase tracking-[0.14em] opacity-60">
            {t("todayIs", { date })}
          </p>
        )}

        {/* Four stats. Each cell is a full-height column with the label at the
            top and the value pinned to the bottom, so a label that wraps onto a
            second line — "Al sol, en el mejor momento" does, in every locale —
            does not drop its number below the ones beside it. Aligning them by
            hand with a min-height would have to be re-tuned per language. */}
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:mt-7 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-0">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex h-full flex-col justify-between gap-3 ${
                i > 0 ? "sm:border-l sm:border-current/15 sm:pl-6" : ""
              }`}
            >
              <dt className="text-caption uppercase leading-snug tracking-wider opacity-60">
                {stat.label}
              </dt>
              {/* `11:45\u201314:00` is eleven monospace characters; at 24px that is
                  wider than a half-width column on a 390px phone, and the two
                  values collided. It scales up only once there is room. */}
              <dd className="font-mono text-lg font-semibold whitespace-nowrap tabular-nums sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 space-y-1 border-t border-current/10 pt-4 text-caption leading-relaxed opacity-60">
          <p>{t("clearSky")}</p>
          {date && <p>{t("recomputed", { city: cityName })}</p>}
        </div>
      </PhaseWindow>
    </>
  );
}
