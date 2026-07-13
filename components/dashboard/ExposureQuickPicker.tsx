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
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-caption text-text-faint uppercase tracking-wider">
          {t("exposureLabel")}
        </span>
        {isOverride && (
          <button
            type="button"
            onClick={onReset}
            className="text-caption text-text-faint hover:text-accent transition-colors cursor-pointer"
            title={t("exposureResetDefault")}
          >
            ✕ {t("exposureResetDefault")}
          </button>
        )}
      </div>
      {/* 2×2 grid of larger option tiles — fills the card and reads better than
          a single cramped row of pills. */}
      <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-3">
        {AREA_PRESETS.map((p) => (
          <button
            type="button"
            key={p.value}
            onClick={() => onChange(p.value)}
            aria-pressed={value === p.value}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-center transition-all cursor-pointer ${
              value === p.value
                ? "bg-amber-400/20 text-accent border border-amber-400/40 font-semibold shadow-sm"
                : "bg-surface-elevated/50 text-text-muted border border-transparent hover:bg-surface-elevated hover:text-text-secondary"
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>{ICONS[p.value]}</span>
            <span className="text-caption leading-tight">{shortLabels[p.value] ?? p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
