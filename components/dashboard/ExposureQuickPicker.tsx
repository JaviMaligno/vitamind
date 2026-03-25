"use client";

import { useTranslations } from "next-intl";
import { AREA_PRESETS } from "@/lib/vitd";

interface Props {
  value: number;
  onChange: (v: number) => void;
  isOverride: boolean;
  onReset: () => void;
}

const ICONS: Record<number, string> = {
  0.10: "🧤",
  0.18: "💪",
  0.25: "👕",
  0.40: "🩱",
};

export default function ExposureQuickPicker({ value, onChange, isOverride, onReset }: Props) {
  const t = useTranslations("dashboard");

  const shortLabels: Record<number, string> = {
    0.10: t("exposureFaceHands"),
    0.18: t("exposureFaceArms"),
    0.25: t("exposureTshirt"),
    0.40: t("exposureSwimsuit"),
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] text-text-faint uppercase tracking-wider mr-0.5">
        {t("exposureLabel")}
      </span>
      {AREA_PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-2 py-1 rounded-full text-[10px] transition-all cursor-pointer ${
            value === p.value
              ? "bg-amber-400/20 text-amber-400 border border-amber-400/30 font-semibold"
              : "bg-surface-elevated/50 text-text-muted border border-transparent hover:bg-surface-elevated hover:text-text-secondary"
          }`}
        >
          {ICONS[p.value]} {shortLabels[p.value] ?? p.label}
        </button>
      ))}
      {isOverride && (
        <button
          onClick={onReset}
          className="text-[9px] text-text-faint hover:text-amber-400 transition-colors cursor-pointer ml-0.5"
          title={t("exposureResetDefault")}
        >
          ✕
        </button>
      )}
    </div>
  );
}
