"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { computeExposure, computeExposureFromCurve, type SkinType } from "@/lib/vitd";
import type { WeatherData, SolarPoint } from "@/lib/types";

interface Props {
  weather: WeatherData | null;
  curve: SolarPoint[];
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
}

function fmtMin(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

export default function VitDEstimate({ weather, curve, skinType, areaFraction, age }: Props) {
  const t = useTranslations("estimate");

  const weatherResult = useMemo(
    () => weather ? computeExposure(weather.hours, skinType, areaFraction, 1000, age) : null,
    [weather, skinType, areaFraction, age],
  );
  const curveResult = useMemo(
    () => (!weather && curve.length) ? computeExposureFromCurve(curve, skinType, areaFraction, 1000, age) : null,
    [weather, curve, skinType, areaFraction, age],
  );
  const result = weatherResult ?? curveResult;
  const isTheoretical = !weatherResult && !!curveResult;

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      borderRadius: 10,
      padding: "12px 14px",
      border: "1px solid rgba(255,255,255,0.05)",
      marginTop: 10,
    }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        {t("title")}
        {isTheoretical && (
          <span style={{ marginLeft: 8, fontSize: 9, color: "rgba(255,213,79,0.5)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            {t("theoreticalHint")}
          </span>
        )}
      </div>

      {!result && (
        <div style={{ fontSize: 12, color: "#ef5350", fontWeight: 600 }}>
          {t("insufficientUV")}
        </div>
      )}
      {result && (
        <div>
          {/* Main result */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "baseline", marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#FFD54F", fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtMin(result.minutesNeeded)}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>
                {t("for1000IU")}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
              <div>{t("bestHour")} <strong style={{ color: "#FFD54F" }}>{result.bestHour}:00</strong> (UVI {result.bestUVI.toFixed(1)})</div>
              <div>{t("uvWindow")} <strong style={{ color: "rgba(255,255,255,0.5)" }}>{result.windowStart}:00 – {result.windowEnd}:00</strong></div>
            </div>
          </div>

          {/* Hourly bar chart */}
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>
            {t("hourlyTitle")}
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
                          ? "rgba(255,213,79,0.6)"
                          : h.minutes !== null && h.minutes <= 30
                            ? "rgba(255,143,0,0.5)"
                            : "rgba(255,109,0,0.3)"
                        : "rgba(255,255,255,0.05)",
                    }} />
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.2)" }}>{h.hour}</span>
                  </div>
                );
              })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(255,213,79,0.6)", marginRight: 3, verticalAlign: "middle" }} />{t("lte15")}</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(255,143,0,0.5)", marginRight: 3, verticalAlign: "middle" }} />{t("lte30")}</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(255,109,0,0.3)", marginRight: 3, verticalAlign: "middle" }} />{t("gt30")}</span>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", marginTop: 8, lineHeight: 1.4 }}>
            {isTheoretical ? t("disclaimerTheoretical") : t("disclaimerReal")}
          </div>
        </div>
      )}
    </div>
  );
}
