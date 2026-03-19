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
  targetIU: number;
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

export default function ForecastRow({ forecast, skinType, areaFraction, age, targetIU }: Props) {
  const t = useTranslations("dashboard");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (!forecast) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-3">{t("forecast")}</h3>
        <p className="text-sm text-text-muted">{t("noForecast")}</p>
      </div>
    );
  }

  const expandedDay = expandedDate ? forecast.find((d) => d.date === expandedDate) : null;
  const exposure = expandedDay
    ? computeExposure(expandedDay.hours, skinType, areaFraction, targetIU, age)
    : null;

  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-faint mb-3">{t("forecast")}</h3>
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
                  ? "bg-surface-elevated border-amber-400/30"
                  : "bg-surface-card border-border-subtle hover:border-border-default"
              }`}
            >
              <span className="text-[11px] font-medium text-text-secondary">{day.dayName}</span>
              <span className="text-lg">{weatherIcon(day.avgCloud, day.peakUVI)}</span>
              <span className={`text-xs font-mono font-semibold ${day.peakUVI >= 3 ? "text-amber-400" : "text-text-muted"}`}>
                UVI {day.peakUVI}
              </span>
              <span className="text-[10px] text-text-muted">
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
          <div className="mt-3 pt-3 border-t border-border-default space-y-2">
            {exposure ? (
              <>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-faint block">{t("forecastWindow")}</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {formatHour(exposure.windowStart)} – {formatHour(exposure.windowEnd)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-faint block">{t("peakUVI")}</span>
                    <span className="font-mono text-text-secondary font-semibold">{exposure.bestUVI.toFixed(1)}</span>
                  </div>
                </div>

                <p className="text-xs text-text-secondary">
                  {t("forecastMinutes", { minutes: Math.round(exposure.minutesNeeded), area: t(getAreaKey(areaFraction)) })}
                </p>

                {/* Hourly table */}
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-text-faint">{t("forecastHourly")}</span>
                  <div className="mt-1 space-y-0.5">
                    {exposure.hourlyMinutes
                      .filter((h) => h.uvi >= 3)
                      .map((h) => (
                        <div key={h.hour} className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-text-muted w-8">{String(h.hour).padStart(2, "0")}h</span>
                          <span className="text-amber-400/70 w-12">UVI {h.uvi.toFixed(1)}</span>
                          <span className="text-text-secondary">{"\u{2192}"} {h.minutes !== null ? `${Math.round(h.minutes)} min` : "\u{2014}"}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <p className="text-[10px] text-text-faint">
                  {t("forecastCloud", { percent: expandedDay.avgCloud })}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">{t("noSynthesisDay")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
