"use client";

import { useMemo, useState } from "react";
import { computeExposure, SKIN_LABELS, AREA_PRESETS, type SkinType } from "@/lib/vitd";
import type { WeatherData } from "@/lib/types";

interface Props {
  weather: WeatherData | null;
  skinType: SkinType;
  areaFraction: number;
  onSkinChange: (s: SkinType) => void;
  onAreaChange: (a: number) => void;
}

function fmtMin(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

const SKIN_HELP = [
  { type: "I", desc: "Piel muy palida, pecas, pelo rubio/pelirrojo. Siempre se quema, nunca se broncea.", example: "Norte de Europa, Irlanda" },
  { type: "II", desc: "Piel clara, pelo rubio. Se quema facilmente, se broncea poco.", example: "Europa central/norte" },
  { type: "III", desc: "Piel media, pelo castano. A veces se quema, se broncea gradualmente.", example: "Sur de Europa, Mediterraneo" },
  { type: "IV", desc: "Piel oliva, pelo oscuro. Rara vez se quema, se broncea bien.", example: "Mediterraneo, Latinoamerica, Asia" },
  { type: "V", desc: "Piel morena. Muy rara vez se quema.", example: "Oriente Medio, Sur de Asia, Norte de Africa" },
  { type: "VI", desc: "Piel oscura/negra. Nunca se quema.", example: "Africa subsahariana, Melanesia" },
];

export default function VitDEstimate({ weather, skinType, areaFraction, onSkinChange, onAreaChange }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const result = useMemo(
    () => weather ? computeExposure(weather.hours, skinType, areaFraction) : null,
    [weather, skinType, areaFraction],
  );

  const selectStyle: React.CSSProperties = {
    padding: "5px 8px",
    borderRadius: 6,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e0e0e0",
    fontSize: 11,
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      borderRadius: 10,
      padding: "12px 14px",
      border: "1px solid rgba(255,255,255,0.05)",
      marginTop: 10,
    }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        Estimacion Vitamina D
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <select
            value={skinType}
            onChange={(e) => onSkinChange(Number(e.target.value) as SkinType)}
            style={selectStyle}
          >
            {([1, 2, 3, 4, 5, 6] as SkinType[]).map((t) => (
              <option key={t} value={t}>{SKIN_LABELS[t]}</option>
            ))}
          </select>
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)",
              background: showHelp ? "rgba(255,213,79,0.15)" : "rgba(255,255,255,0.05)",
              color: showHelp ? "#FFD54F" : "rgba(255,255,255,0.4)",
              fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, lineHeight: 1,
            }}
            title="Como identificar tu tipo de piel"
          >
            ?
          </button>
        </div>
        <select
          value={areaFraction}
          onChange={(e) => onAreaChange(Number(e.target.value))}
          style={selectStyle}
        >
          {AREA_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Skin type help */}
      {showHelp && (
        <div style={{
          marginBottom: 10, padding: "10px 12px", borderRadius: 8,
          background: "rgba(255,213,79,0.04)", border: "1px solid rgba(255,213,79,0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#FFD54F", marginBottom: 6 }}>
            Escala Fitzpatrick — Tipo de piel
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, lineHeight: 1.4 }}>
            Piensa en como reacciona tu piel tras 30 minutos de sol de verano sin proteccion:
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {SKIN_HELP.map((s, i) => (
              <div
                key={s.type}
                onClick={() => { onSkinChange((i + 1) as SkinType); setShowHelp(false); }}
                style={{
                  display: "flex", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                  background: skinType === i + 1 ? "rgba(255,213,79,0.1)" : "rgba(255,255,255,0.02)",
                  border: skinType === i + 1 ? "1px solid rgba(255,213,79,0.2)" : "1px solid transparent",
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: "#FFD54F", minWidth: 18 }}>{s.type}</span>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>{s.desc}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>{s.example}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {!weather && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
          Sin datos meteorologicos para esta fecha/ubicacion
        </div>
      )}
      {weather && !result && (
        <div style={{ fontSize: 12, color: "#ef5350", fontWeight: 600 }}>
          UV insuficiente (UVI &lt; 3) — no es posible sintetizar vitamina D hoy
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
                para 1000 IU
              </span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
              <div>Mejor hora: <strong style={{ color: "#FFD54F" }}>{result.bestHour}:00</strong> (UVI {result.bestUVI.toFixed(1)})</div>
              <div>Ventana UV: <strong style={{ color: "rgba(255,255,255,0.5)" }}>{result.windowStart}:00 – {result.windowEnd}:00</strong></div>
            </div>
          </div>

          {/* Hourly bar chart */}
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>
            Tiempo por hora (min para 1000 IU)
          </div>
          <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 50 }}>
            {result.hourlyMinutes
              .filter((h) => h.hour >= 6 && h.hour <= 20)
              .map((h) => {
                const maxBar = 60; // scale: 60 min = full height
                const barH = h.minutes !== null ? Math.min(1, h.minutes / maxBar) : 0;
                const isActive = h.uvi >= 3;
                return (
                  <div
                    key={h.hour}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
                    title={h.minutes !== null ? `${h.hour}:00 — UVI ${h.uvi.toFixed(1)} — ${Math.round(h.minutes)} min` : `${h.hour}:00 — UVI ${h.uvi.toFixed(1)} — Sin sintesis`}
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
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(255,213,79,0.6)", marginRight: 3, verticalAlign: "middle" }} />&le;15 min</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(255,143,0,0.5)", marginRight: 3, verticalAlign: "middle" }} />&le;30 min</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(255,109,0,0.3)", marginRight: 3, verticalAlign: "middle" }} />&gt;30 min</span>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", marginTop: 8, lineHeight: 1.4 }}>
            Basado en la regla de Holick (Dowdy et al. 2010). Estimacion orientativa — no sustituye consejo medico.
            Factores como protector solar, cristales, ropa o altitud pueden variar el resultado.
          </div>
        </div>
      )}
    </div>
  );
}
