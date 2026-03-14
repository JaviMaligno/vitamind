"use client";

import { useTranslations } from "next-intl";
import type { DayRecord } from "@/lib/types";

interface Props {
  monthRecords: DayRecord[];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function MonthSummary({ monthRecords }: Props) {
  const t = useTranslations("dashboard");

  const now = new Date();
  const totalDays = daysInMonth(now.getFullYear(), now.getMonth());

  const favorableCount = monthRecords.filter((r) => {
    if (r.userOverride !== null) return r.userOverride;
    return r.sufficient;
  }).length;

  const percentage = monthRecords.length > 0 ? Math.round((favorableCount / monthRecords.length) * 100) : 0;
  const showSupplement = favorableCount < monthRecords.length * 0.4;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("monthSummary")}</h3>

      <div className="relative w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500/60 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="text-sm text-white/50">
        {t("monthCount", { count: favorableCount, total: totalDays })}
      </p>

      {showSupplement && monthRecords.length >= 7 && (
        <p className="text-xs text-amber-400/50 mt-2">
          {t("supplementHint")}
        </p>
      )}
    </div>
  );
}
