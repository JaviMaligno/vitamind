"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { computeExposure } from "@/lib/vitd";
import type { ForecastDay } from "@/hooks/useForecast";
import type { SkinType } from "@/lib/vitd";

interface Props {
  forecast: ForecastDay[] | null;
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
}

function weatherIcon(avgCloud: number, peakUVI: number): string {
  if (peakUVI < 1) return "\u{2601}\u{FE0F}";
  if (avgCloud > 70) return "\u{1F325}\u{FE0F}";
  if (avgCloud > 30) return "\u{26C5}";
  return "\u{2600}\u{FE0F}";
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function getAreaKey(areaFraction: number): string {
  if (areaFraction <= 0.10) return "faceHands";
  if (areaFraction <= 0.18) return "faceArms";
  if (areaFraction <= 0.25) return "tshirtShort";
  return "swimsuit";
}

export default function ForecastRow({ forecast, skinType, areaFraction, age }: Props) {
  const t = useTranslations("dashboard");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (!forecast) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("forecast")}</h3>
        <p className="text-sm text-white/30">{t("noForecast")}</p>
      </div>
    );
  }

  const expandedDay = expandedDate ? forecast.find((d) => d.date === expandedDate) : null;
  const exposure = expandedDay
    ? computeExposure(expandedDay.hours, skinType, areaFraction, 1000, age)
    : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("forecast")}</h3>
      <div className="flex gap-2 overflow-x-auto">
        {forecast.map((day) => {
          const hasWindow = day.windowStart >= 0 && day.windowEnd > day.windowStart;
          const isExpanded = expandedDate === day.date;
          return (
            <button
              key={day.date}
              onClick={() => setExpandedDate(isExpanded ? null : day.date)}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 min-w-[72px] transition-colors cursor-pointer ${
                isExpanded
                  ? "bg-white/[0.06] border-amber-400/30"
                  : "bg-white/[0.03] border-white/[0.04] hover:border-white/[0.08]"
              }`}
            >
              <span className="text-[11px] font-medium text-white/40">{day.dayName}</span>
              <span className="text-lg">{weatherIcon(day.avgCloud, day.peakUVI)}</span>
              <span className={`text-xs font-mono font-semibold ${day.peakUVI >= 3 ? "text-amber-400" : "text-white/30"}`}>
                UVI {day.peakUVI}
              </span>
              <span className="text-[10px] text-white/30">
                {hasWindow ? `${day.windowStart}\u{2013}${day.windowEnd}h` : "\u{2014}"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expandedDay ? "300px" : "0px", opacity: expandedDay ? 1 : 0 }}
      >
        {expandedDay && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
            {exposure ? (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/25 block">{t("forecastWindow")}</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {formatHour(exposure.windowStart)} – {formatHour(exposure.windowEnd)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/25 block">{t("peakUVI")}</span>
                    <span className="font-mono text-white/70 font-semibold">{exposure.bestUVI.toFixed(1)}</span>
                  </div>
                </div>

                <p className="text-xs text-white/40">
                  {t("forecastMinutes", { minutes: Math.round(exposure.minutesNeeded), area: t(getAreaKey(areaFraction)) })}
                </p>

                {/* Hourly table */}
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-white/25">{t("forecastHourly")}</span>
                  <div className="mt-1 space-y-0.5">
                    {exposure.hourlyMinutes
                      .filter((h) => h.uvi >= 3)
                      .map((h) => (
                        <div key={h.hour} className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-white/30 w-8">{String(h.hour).padStart(2, "0")}h</span>
                          <span className="text-amber-400/70 w-12">UVI {h.uvi.toFixed(1)}</span>
                          <span className="text-white/50">{"\u{2192}"} {h.minutes !== null ? `${Math.round(h.minutes)} min` : "\u{2014}"}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <p className="text-[10px] text-white/25">
                  {t("forecastCloud", { percent: expandedDay.avgCloud })}
                </p>
              </>
            ) : (
              <p className="text-sm text-white/30">{t("noSynthesisDay")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
