"use client";

import { useState } from "react";
import { SKIN_LABELS, AREA_PRESETS, type SkinType } from "@/lib/vitd";

interface Props {
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  onSkinChange: (s: SkinType) => void;
  onAreaChange: (a: number) => void;
  onAgeChange: (a: number | null) => void;
}

const SKIN_HELP = [
  { type: "I", desc: "Piel muy palida, pecas, pelo rubio/pelirrojo. Siempre se quema, nunca se broncea.", example: "Norte de Europa, Irlanda" },
  { type: "II", desc: "Piel clara, pelo rubio. Se quema facilmente, se broncea poco.", example: "Europa central/norte" },
  { type: "III", desc: "Piel media, pelo castano. A veces se quema, se broncea gradualmente.", example: "Sur de Europa, Mediterraneo" },
  { type: "IV", desc: "Piel oliva, pelo oscuro. Rara vez se quema, se broncea bien.", example: "Mediterraneo, Latinoamerica, Asia" },
  { type: "V", desc: "Piel morena. Muy rara vez se quema.", example: "Oriente Medio, Sur de Asia, Norte de Africa" },
  { type: "VI", desc: "Piel oscura/negra. Nunca se quema.", example: "Africa subsahariana, Melanesia" },
];

export default function SkinSelector({ skinType, areaFraction, age, onSkinChange, onAreaChange, onAgeChange }: Props) {
  const [showHelp, setShowHelp] = useState(false);

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
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>Tu piel:</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <select value={skinType} onChange={(e) => onSkinChange(Number(e.target.value) as SkinType)} style={selectStyle}>
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
          >?</button>
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>Exposicion:</span>
        <select value={areaFraction} onChange={(e) => onAreaChange(Number(e.target.value))} style={selectStyle}>
          {AREA_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>Edad:</span>
        <input
          type="number"
          min="1"
          max="120"
          placeholder="—"
          value={age ?? ""}
          onChange={(e) => onAgeChange(e.target.value ? parseInt(e.target.value) : null)}
          style={{ ...selectStyle, width: 50, textAlign: "center" }}
        />
      </div>

      {showHelp && (
        <div style={{
          marginTop: 8, padding: "10px 12px", borderRadius: 8,
          background: "rgba(255,213,79,0.04)", border: "1px solid rgba(255,213,79,0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#FFD54F", marginBottom: 6 }}>
            Escala Fitzpatrick — Tipo de piel
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, lineHeight: 1.4 }}>
            Piensa en como reacciona tu piel tras 30 min de sol de verano sin proteccion:
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
    </div>
  );
}
