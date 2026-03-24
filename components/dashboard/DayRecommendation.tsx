"use client";

import { useTranslations } from "next-intl";
import type { SkinType } from "@/lib/vitd";
import type { NowStatus } from "@/lib/types";

interface Props {
  nowStatus: NowStatus;
  cityName: string;
  cityFlag: string;
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  targetIU: number;
  loading: boolean;
}

function formatCountdown(totalMinutes: number): string {
  if (totalMinutes < 1) return "<1 min";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function fmtMin(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `~${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

type StatusKey = "optimal" | "moderate" | "upcoming" | "windowClosed" | "insufficient";

function getStatusKey(ns: NowStatus): StatusKey {
  if (ns.state === "good_now") return ns.intensity === "optimal" ? "optimal" : "moderate";
  if (ns.state === "upcoming") return "upcoming";
  if (ns.state === "window_closed") return "windowClosed";
  return "insufficient";
}

const COLOR_MAP: Record<StatusKey, { border: string; bg: string; dot: string; text: string }> = {
  optimal: { border: "border-green-400/20", bg: "from-green-400/[0.08] to-amber-400/[0.04]", dot: "bg-green-400", text: "text-green-400/80" },
  moderate: { border: "border-amber-400/15", bg: "from-amber-400/[0.06] to-orange-600/[0.03]", dot: "bg-amber-400", text: "text-amber-400/70" },
  upcoming: { border: "border-blue-400/15", bg: "from-blue-400/[0.04] to-blue-600/[0.02]", dot: "bg-blue-400", text: "text-blue-400/70" },
  windowClosed: { border: "border-gray-400/15", bg: "from-gray-400/[0.04] to-gray-600/[0.02]", dot: "bg-gray-400", text: "text-gray-400/70" },
  insufficient: { border: "border-red-400/10", bg: "from-red-500/[0.06] to-red-900/[0.03]", dot: "bg-red-400", text: "text-red-400/70" },
};

export default function DayRecommendation({ nowStatus, cityName, cityFlag, skinType, areaFraction, age, targetIU, loading }: Props) {
  const t = useTranslations("dashboard");
  const ns = nowStatus;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface-card p-6 animate-pulse">
        <div className="h-8 bg-surface-elevated rounded w-3/4 mb-3" />
        <div className="h-5 bg-surface-elevated rounded w-1/2" />
      </div>
    );
  }

  const statusKey = getStatusKey(ns);
  const colors = COLOR_MAP[statusKey];
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className={`rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-6 shadow-lg`}>
      {/* Header: city + date */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-secondary">{cityFlag} {cityName}</span>
        <span className="text-xs text-text-muted">{todayStr}</span>
      </div>

      {/* Status dot + label */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
          {t(`now_${statusKey}`)}
        </span>
      </div>

      {/* State-specific content */}
      {ns.state === "good_now" && ns.intensity === "optimal" && (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("nowOptimalTitle")}
          </h2>
          <p className="text-sm text-text-muted mb-4">
            {t("nowOptimalHint")}
          </p>
        </>
      )}

      {ns.state === "good_now" && ns.intensity === "moderate" && (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("nowModerateTitle")}
          </h2>
          <p className="text-sm text-text-muted mb-4">
            {t("nowModerateHint")}
          </p>
        </>
      )}

      {ns.state === "upcoming" && (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("nowUpcomingTitle", { countdown: formatCountdown(ns.minutesUntilWindow ?? 0), hour: `${ns.window?.start ?? 0}:00` })}
          </h2>
          {ns.cloudDegraded && (
            <p className="text-sm text-amber-400/70 mb-2">
              {t("cloudDegraded")}
            </p>
          )}
        </>
      )}

      {ns.state === "window_closed" && (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("nowClosedTitle", { hour: `${ns.window?.end ?? 0}:00` })}
          </h2>
          <p className="text-sm text-text-muted mb-4">
            {t("nowClosedHint")}
          </p>
        </>
      )}

      {ns.state === "no_synthesis" && (
        <>
          <h2 className="text-[28px] md:text-[32px] font-bold text-text-primary leading-tight mb-2">
            {t("noWindowToday")}
          </h2>
          <p className="text-sm text-text-muted mb-4">
            {ns.cloudDegraded ? t("cloudDegradedFull") : t("noWindowHint")}
          </p>
        </>
      )}

      {/* Data row — always shown when there's useful data */}
      {(ns.state === "good_now" || ns.state === "upcoming") && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-2">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">{t("currentUVI")}</span>
            <span className="font-mono text-[15px] font-semibold text-text-primary">{ns.effectiveUVI.toFixed(1)}</span>
          </div>
          {ns.window && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">{t("nowWindow")}</span>
              <span className="text-[15px] text-text-secondary">{ns.window.start}:00 – {ns.window.end}:00</span>
            </div>
          )}
          {ns.state === "good_now" && ns.minutesNeeded !== null && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">{t("nowTimeNeeded")}</span>
              <span className="font-mono text-[15px] font-semibold text-amber-400">{fmtMin(ns.minutesNeeded)}</span>
              <span className="text-[11px] text-text-faint ml-1">{t("forIU", { iu: targetIU })}</span>
            </div>
          )}
          {ns.state === "good_now" && ns.windowClosesIn !== null && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">{t("nowClosesIn")}</span>
              <span className="text-[15px] text-text-secondary">{formatCountdown(ns.windowClosesIn)}</span>
            </div>
          )}
          {ns.state === "upcoming" && ns.bestHour !== null && ns.bestMinutes !== null && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-text-faint block mb-0.5">{t("nowBestHour")}</span>
              <span className="text-[15px] text-text-secondary">{fmtMin(ns.bestMinutes)} {t("atHour", { hour: `${ns.bestHour}:00` })}</span>
              <span className="text-[11px] text-text-faint ml-1">{t("forIU", { iu: targetIU })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
