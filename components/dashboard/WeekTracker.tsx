"use client";

import { useTranslations } from "next-intl";
import type { DayRecord } from "@/lib/types";

interface Props {
  weekRecords: DayRecord[];
  onToggleOverride: (date: string) => void;
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function isEffectivelySufficient(r: DayRecord): boolean {
  if (r.userOverride !== null) return r.userOverride;
  return r.sufficient;
}

export default function WeekTracker({ weekRecords, onToggleOverride }: Props) {
  const t = useTranslations("dashboard");
  const today = new Date();
  const todayStr = toDateStr(today);
  const monday = getMonday(today);

  const days: { dateStr: string; label: string; record: DayRecord | null; isFuture: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const ds = toDateStr(d);
    days.push({
      dateStr: ds,
      label: DAY_LABELS[i],
      record: weekRecords.find((r) => r.date === ds) ?? null,
      isFuture: d > today,
      isToday: ds === todayStr,
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/25 mb-3">{t("weekTracker")}</h3>

      <div className="flex justify-between gap-1">
        {days.map((day) => {
          let bgColor = "bg-white/[0.04]";
          let borderStyle = "";

          if (day.isToday) {
            borderStyle = "border-2 border-dashed border-amber-400/40";
          }

          if (!day.isFuture && day.record) {
            const sufficient = isEffectivelySufficient(day.record);
            bgColor = sufficient ? "bg-emerald-500/30" : "bg-white/[0.06]";

            if (day.record.userOverride !== null) {
              borderStyle += " ring-1 ring-white/20";
            }
          }

          return (
            <button
              key={day.dateStr}
              onClick={() => day.record && !day.isFuture && onToggleOverride(day.dateStr)}
              disabled={day.isFuture || !day.record}
              className={`flex items-center justify-center rounded-full w-10 h-10 flex-shrink-0 transition-colors ${bgColor} ${borderStyle} ${
                day.isFuture ? "opacity-30 cursor-default" : "cursor-pointer hover:ring-1 hover:ring-amber-400/30"
              }`}
              title={
                day.record?.userOverride === null
                  ? undefined
                  : day.record?.userOverride
                    ? t("didGoOut")
                    : t("didntGoOut")
              }
            >
              <span className="text-[10px] font-medium text-white/50">{day.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-white/20 mt-2 text-center">{t("overrideHint")}</p>
    </div>
  );
}
