"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
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

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-x-3 gap-y-2 items-center">
        <span className="text-caption text-text-faint uppercase tracking-wider">{t("type")}</span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <select
              value={skinType}
              onChange={(e) => onSkinChange(Number(e.target.value) as SkinType)}
              className="min-h-[44px] appearance-none rounded-lg bg-surface-input border border-border-default pl-3 pr-9 text-text-primary text-body cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sun"
            >
              {([1, 2, 3, 4, 5, 6] as SkinType[]).map((st) => (
                <option key={st} value={st}>{skinLabels[st]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          </div>
          {/* 44px hit area, smaller visible circle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex h-11 w-11 items-center justify-center cursor-pointer"
            title={t("help")}
            aria-label={t("help")}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold leading-none ${
              showHelp
                ? "border-amber-400/30 bg-amber-400/15 text-accent"
                : "border-border-default bg-surface-elevated text-text-muted"
            }`}>?</span>
          </button>
        </div>
        <span className="text-caption text-text-faint uppercase tracking-wider">{t("area")}</span>
        <div className="relative">
          <select
            value={areaFraction}
            onChange={(e) => onAreaChange(Number(e.target.value))}
            className="min-h-[44px] appearance-none rounded-lg bg-surface-input border border-border-default pl-3 pr-9 text-text-primary text-body cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sun"
          >
            {AREA_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{areaLabels[p.value] ?? p.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
        </div>
        <span className="text-caption text-text-faint uppercase tracking-wider">{t("age")}</span>
        <input
          type="number"
          min="1"
          max="120"
          placeholder="—"
          value={age ?? ""}
          onChange={(e) => onAgeChange(e.target.value ? parseInt(e.target.value) : null)}
          className="w-16 min-h-[44px] px-2 rounded-lg bg-surface-input border border-border-default text-text-primary text-body text-center outline-none focus-visible:ring-2 focus-visible:ring-sun"
        />
      </div>

      {showHelp && (
        <div className="mt-2 p-3 rounded-lg bg-amber-400/[0.04] border border-amber-400/10">
          <div className="text-[11px] font-semibold text-accent mb-1.5">
            {t("fitzpatrickTitle")}
          </div>
          <div className="text-[10px] text-text-muted mb-2 leading-relaxed">
            {t("fitzpatrickHint")}
          </div>
          <div className="grid gap-1">
            {skinHelp.map((s, i) => (
              <div
                key={s.type}
                onClick={() => { onSkinChange((i + 1) as SkinType); setShowHelp(false); }}
                className={`flex gap-2 px-2 py-1.5 rounded-md cursor-pointer ${
                  skinType === i + 1
                    ? "bg-amber-400/10 border border-amber-400/20"
                    : "bg-surface-card border border-transparent"
                }`}
              >
                <span className="font-mono text-[10px] font-bold text-accent min-w-[18px]">{s.type}</span>
                <div>
                  <div className="text-[10px] text-text-secondary leading-snug">{s.desc}</div>
                  <div className="text-[9px] text-text-faint mt-0.5">{s.example}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
