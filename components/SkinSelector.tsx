"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AREA_PRESETS, type SkinType } from "@/lib/vitd";

interface Props {
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  onSkinChange: (s: SkinType) => void;
  onAreaChange: (a: number) => void;
  onAgeChange: (a: number | null) => void;
}

export default function SkinSelector({ skinType, areaFraction, age, onSkinChange, onAreaChange, onAgeChange }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const t = useTranslations("skin");

  const skinLabels: Record<SkinType, string> = {
    1: t("type1"),
    2: t("type2"),
    3: t("type3"),
    4: t("type4"),
    5: t("type5"),
    6: t("type6"),
  };

  const skinHelp = [
    { type: "I", desc: t("desc1"), example: t("example1") },
    { type: "II", desc: t("desc2"), example: t("example2") },
    { type: "III", desc: t("desc3"), example: t("example3") },
    { type: "IV", desc: t("desc4"), example: t("example4") },
    { type: "V", desc: t("desc5"), example: t("example5") },
    { type: "VI", desc: t("desc6"), example: t("example6") },
  ];

  const areaLabels: Record<number, string> = {
    0.10: t("areaFaceHands"),
    0.18: t("areaFaceArms"),
    0.25: t("areaTshirtShort"),
    0.40: t("areaSwimsuit"),
  };

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
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>{t("type")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <select value={skinType} onChange={(e) => onSkinChange(Number(e.target.value) as SkinType)} style={selectStyle}>
            {([1, 2, 3, 4, 5, 6] as SkinType[]).map((st) => (
              <option key={st} value={st}>{skinLabels[st]}</option>
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
            title={t("help")}
          >?</button>
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>{t("area")}</span>
        <select value={areaFraction} onChange={(e) => onAreaChange(Number(e.target.value))} style={selectStyle}>
          {AREA_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{areaLabels[p.value] ?? p.label}</option>
          ))}
        </select>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>{t("age")}</span>
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
            {t("fitzpatrickTitle")}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, lineHeight: 1.4 }}>
            {t("fitzpatrickHint")}
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {skinHelp.map((s, i) => (
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
