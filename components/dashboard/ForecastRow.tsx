"use client";

import { useTranslations } from "next-intl";
import type { ForecastDay } from "@/hooks/useForecast";

interface Props {
  forecast: ForecastDay[] | null;
}

function weatherIcon(avgCloud: number, peakUVI: number): string {
  if (peakUVI < 1) return "\u{2601}\u{FE0F}";
  if (avgCloud > 70) return "\u{1F325}\u{FE0F}";
  if (avgCloud > 30) return "\u{26C5}";
  return "\u{2600}\u{FE0F}";
}

export default function ForecastRow({ forecast }: Props) {
  const t = useTranslations("dashboard");

  if (!forecast) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("forecast")}</h3>
        <p className="text-sm text-white/30">{t("noForecast")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("forecast")}</h3>
      <div className="flex gap-2 overflow-x-auto">
        {forecast.map((day) => {
          const hasWindow = day.windowStart >= 0 && day.windowEnd > day.windowStart;
          return (
            <div
              key={day.date}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5 min-w-[72px]"
            >
              <span className="text-[11px] font-medium text-white/40">{day.dayName}</span>
              <span className="text-lg">{weatherIcon(day.avgCloud, day.peakUVI)}</span>
              <span className={`text-xs font-mono font-semibold ${day.peakUVI >= 3 ? "text-amber-400" : "text-white/30"}`}>
                UVI {day.peakUVI}
              </span>
              <span className="text-[10px] text-white/30">
                {hasWindow ? `${day.windowStart}\u{2013}${day.windowEnd}h` : "\u{2014}"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
