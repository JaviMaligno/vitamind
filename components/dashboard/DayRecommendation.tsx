"use client";

import { useTranslations } from "next-intl";
import type { DayRecord } from "@/lib/types";

interface Props {
  record: DayRecord | null;
  cityName: string;
  cityFlag: string;
  areaFraction: number;
  targetIU: number;
  loading: boolean;
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getAreaKey(areaFraction: number): string {
  if (areaFraction <= 0.10) return "faceHands";
  if (areaFraction <= 0.18) return "faceArms";
  if (areaFraction <= 0.25) return "tshirtShort";
  return "swimsuit";
}

export default function DayRecommendation({ record, cityName, cityFlag, areaFraction, targetIU, loading }: Props) {
  const t = useTranslations("dashboard");

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface-card p-6 animate-pulse">
        <div className="h-8 bg-surface-elevated rounded w-3/4 mb-3" />
        <div className="h-5 bg-surface-elevated rounded w-1/2" />
      </div>
    );
  }

  const hasSynthesis = record?.sufficient ?? false;
  const hasWindow = record && record.windowStart >= 0 && record.windowEnd > record.windowStart;

  const status = hasSynthesis ? "favorable" : (record && record.peakUVI >= 2 ? "marginal" : "insufficient");
  const colorMap = {
    favorable: { border: "border-amber-400/15", bg: "from-amber-400/[0.06] to-orange-600/[0.03]", dot: "bg-amber-400", text: "text-amber-400/70" },
    marginal: { border: "border-yellow-400/15", bg: "from-yellow-400/[0.04] to-yellow-600/[0.02]", dot: "bg-yellow-400", text: "text-yellow-400/70" },
    insufficient: { border: "border-red-400/10", bg: "from-red-500/[0.06] to-red-900/[0.03]", dot: "bg-red-400", text: "text-red-400/70" },
  };
  const colors = colorMap[status];

  const todayStr = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={`rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-secondary">{cityFlag} {cityName}</span>
        <span className="text-xs text-text-muted">{todayStr}</span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
          {t(status)}
        </span>
      </div>

      {hasSynthesis && hasWindow && record ? (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("goOutBetween", { start: formatHour(record.windowStart), end: formatHour(record.windowEnd) })}
          </h2>
          <p className="text-sm text-text-muted mb-4">
            {t("youNeed", { minutes: Math.round(record.minutesNeeded), area: t(getAreaKey(areaFraction)), iu: targetIU })}
          </p>

          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">{t("peakUVI")}</span>
              <span className="font-mono text-[15px] font-semibold text-amber-400">{record.peakUVI.toFixed(1)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("noWindowToday")}
          </h2>
          <p className="text-sm text-text-muted">
            {t("noWindowHint")}
          </p>
        </>
      )}
    </div>
  );
}
