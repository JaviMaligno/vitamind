"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import PartnerBadge from "@/components/PartnerBadge";
import { computeExposure, computeExposureFromCurve, type SkinType } from "@/lib/vitd";
import type { WeatherData, SolarPoint } from "@/lib/types";

interface Props {
  weather: WeatherData | null;
  curve: SolarPoint[];
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  targetIU: number;
}

function fmtMin(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

export default function VitDEstimate({ weather, curve, skinType, areaFraction, age, targetIU }: Props) {
  const t = useTranslations("estimate");

  const weatherResult = useMemo(
    () => weather ? computeExposure(weather.hours, skinType, areaFraction, targetIU, age) : null,
    [weather, skinType, areaFraction, targetIU, age],
  );
  const curveResult = useMemo(
    () => (!weather && curve.length) ? computeExposureFromCurve(curve, skinType, areaFraction, targetIU, age) : null,
    [weather, curve, skinType, areaFraction, targetIU, age],
  );
  const result = weatherResult ?? curveResult;
  const isTheoretical = !weatherResult && !!curveResult;

  return (
    <div className="bg-surface-card rounded-xl p-3.5 border border-border-subtle mt-2.5">
      <div className="text-[10px] text-text-secondary font-semibold mb-2 uppercase tracking-wider">
        {t("title")}
        {isTheoretical && (
          <span className="ml-2 text-[9px] text-amber-400/50 font-normal normal-case tracking-normal">
            {t("theoreticalHint")}
          </span>
        )}
      </div>

      {!result && (
        <div>
          <div className="text-xs text-red-500 font-semibold">
            {t("insufficientUV")}
          </div>
          <div className="text-[11px] text-text-muted mt-2 leading-relaxed">
            💊 <Link href="/learn#supplement" className="underline decoration-dotted hover:text-text-secondary transition-colors">{t("supplementAdvice")}</Link>
          </div>
          <PartnerBadge className="mt-2" />
        </div>
      )}
      {result && (
        <div>
          {/* Main result */}
          <div className="flex flex-wrap gap-4 items-baseline mb-2">
            <div>
              <span className="text-[28px] font-bold text-amber-400 font-mono">
                {fmtMin(result.minutesNeeded)}
              </span>
              <span className="text-[11px] text-text-muted ml-1.5">
                {t("forTargetIU", { iu: targetIU })}
              </span>
            </div>
            <div className="text-[11px] text-text-muted leading-relaxed">
              <div>{t("bestHour")} <strong className="text-amber-400">{result.bestHour}:00</strong> (UVI {result.bestUVI.toFixed(1)})</div>
              <div>{t("uvWindow")} <strong className="text-text-secondary">{result.windowStart}:00 – {result.windowEnd}:00</strong></div>
            </div>
          </div>

          {/* Hourly bar chart */}
          <div className="text-[9px] text-text-faint mb-1">
            {t("hourlyTitleDynamic", { iu: targetIU })}
          </div>
          <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 50 }}>
            {result.hourlyMinutes
              .filter((h) => h.hour >= 6 && h.hour <= 20)
              .map((h) => {
                const maxBar = 60;
                const barH = h.minutes !== null ? Math.min(1, h.minutes / maxBar) : 0;
                const isActive = h.uvi >= 3;
                return (
                  <div
                    key={h.hour}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
                    title={h.minutes !== null ? `${h.hour}:00 — UVI ${h.uvi.toFixed(1)} — ${Math.round(h.minutes)} min` : `${h.hour}:00 — UVI ${h.uvi.toFixed(1)}`}
                  >
                    <div style={{
                      width: "100%",
                      maxWidth: 32,
                      height: isActive ? Math.max(3, (1 - barH) * 44) : 2,
                      borderRadius: "3px 3px 0 0",
                      background: isActive
                        ? h.minutes !== null && h.minutes <= 15
                          ? "var(--color-chart-bar-fast)"
                          : h.minutes !== null && h.minutes <= 30
                            ? "var(--color-chart-bar-medium)"
                            : "var(--color-chart-bar-slow)"
                        : "var(--color-chart-bar-inactive)",
                    }} />
                    <span className="text-[7px] text-text-faint">{h.hour}</span>
                  </div>
                );
              })}
          </div>
          <div className="flex gap-2.5 mt-1.5 text-[8px] text-text-faint">
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-chart-bar-fast)", marginRight: 3, verticalAlign: "middle" }} />{t("lte15")}</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-chart-bar-medium)", marginRight: 3, verticalAlign: "middle" }} />{t("lte30")}</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-chart-bar-slow)", marginRight: 3, verticalAlign: "middle" }} />{t("gt30")}</span>
          </div>

          {/* Warning if target exceeds safe max */}
          {result.targetCapped && (
            <div className="text-[10px] text-amber-500/80 mt-2 leading-relaxed">
              {t("targetCappedWarning", { max: Math.round(result.maxIU) })}
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-[8px] text-text-faint mt-2 leading-relaxed">
            {isTheoretical ? t("disclaimerTheoretical") : t("disclaimerReal")}
          </div>
        </div>
      )}
    </div>
  );
}
