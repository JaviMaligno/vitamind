"use client";

import { useTranslations, useLocale } from "next-intl";
import type { NowStatus } from "@/lib/types";

interface Props {
  nowStatus: NowStatus;
  cityName: string;
  cityFlag: string;
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
  moderate: { border: "border-amber-400/15", bg: "from-amber-400/[0.06] to-orange-600/[0.03]", dot: "bg-amber-400", text: "text-accent/70" },
  upcoming: { border: "border-blue-400/15", bg: "from-blue-400/[0.04] to-blue-600/[0.02]", dot: "bg-blue-400", text: "text-blue-400/70" },
  windowClosed: { border: "border-gray-400/15", bg: "from-gray-400/[0.04] to-gray-600/[0.02]", dot: "bg-gray-400", text: "text-gray-400/70" },
  insufficient: { border: "border-red-400/10", bg: "from-red-500/[0.06] to-red-900/[0.03]", dot: "bg-red-400", text: "text-red-400/70" },
};

/** Content of the "My Day" hero. Rendered as the `children` of `<CityHero>`, whose
 *  glass `Card` already supplies the surface — this component owns only the copy,
 *  not the card chrome (no outer border/background/shadow of its own). */
export default function DayRecommendation({ nowStatus, cityName, cityFlag, targetIU, loading }: Props) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const ns = nowStatus;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-surface-elevated rounded w-3/4 mb-3" />
        <div className="h-5 bg-surface-elevated rounded w-1/2" />
      </div>
    );
  }

  const statusKey = getStatusKey(ns);
  const colors = COLOR_MAP[statusKey];
  const todayStr = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      {/* Header: city + date */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-body text-text-secondary">{cityFlag} {cityName}</span>
        <span className="text-caption text-text-muted">{todayStr}</span>
      </div>

      {/* Status dot + label */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <span className={`text-caption font-semibold uppercase tracking-wider ${colors.text}`}>
          {t(`now_${statusKey}`)}
        </span>
      </div>

      {/* State-specific content */}
      {ns.state === "good_now" && ns.intensity === "optimal" && (
        <>
          <h2 className="font-display text-display text-text-primary leading-tight mb-2">
            {t("nowOptimalTitle")}
          </h2>
          <p className="text-body text-text-muted mb-4">
            {t("nowOptimalHint")}
          </p>
        </>
      )}

      {ns.state === "good_now" && ns.intensity === "moderate" && (
        <>
          <h2 className="font-display text-display text-text-primary leading-tight mb-2">
            {t("nowModerateTitle")}
          </h2>
          <p className="text-body text-text-muted mb-4">
            {t("nowModerateHint")}
          </p>
        </>
      )}

      {ns.state === "upcoming" && (
        <>
          <h2 className="font-display text-display text-text-primary leading-tight mb-2">
            {t("nowUpcomingTitle", { countdown: formatCountdown(ns.minutesUntilWindow ?? 0), hour: `${ns.window?.start ?? 0}:00` })}
          </h2>
          {ns.cloudDegraded && (
            <p className="text-body text-accent/70 mb-2">
              {t("cloudDegraded")}
            </p>
          )}
        </>
      )}

      {ns.state === "window_closed" && (
        <>
          <h2 className="font-display text-display text-text-primary leading-tight mb-2">
            {t("nowClosedTitle", { hour: `${ns.window?.end ?? 0}:00` })}
          </h2>
          <p className="text-body text-text-muted mb-4">
            {t("nowClosedHint")}
          </p>
        </>
      )}

      {ns.state === "no_synthesis" && (
        <>
          <h2 className="font-display text-display text-text-primary leading-tight mb-2">
            {t("noWindowToday")}
          </h2>
          <p className="text-body text-text-muted mb-4">
            {ns.cloudDegraded ? t("cloudDegradedFull") : t("noWindowHint")}
          </p>
        </>
      )}

      {/* Data row — always shown when there's useful data */}
      {(ns.state === "good_now" || ns.state === "upcoming") && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
          <div>
            <span className="text-caption uppercase tracking-wider text-text-faint block mb-0.5">{t("currentUVI")}</span>
            <span className="font-mono text-body font-semibold text-text-primary">{ns.effectiveUVI.toFixed(1)}</span>
          </div>
          {ns.window && (
            <div>
              <span className="text-caption uppercase tracking-wider text-text-faint block mb-0.5">{t("nowWindow")}</span>
              <span className="text-body text-text-secondary">{ns.window.start}:00 – {ns.window.end}:00</span>
            </div>
          )}
          {ns.state === "good_now" && ns.minutesNeeded !== null && (
            <div>
              <span className="text-caption uppercase tracking-wider text-text-faint block mb-0.5">{t("nowTimeNeeded")}</span>
              <span className="font-mono text-body font-semibold text-accent">{fmtMin(ns.minutesNeeded)}</span>
              <span className="text-caption text-text-faint ml-1">{t("forIU", { iu: targetIU })}</span>
            </div>
          )}
          {ns.state === "good_now" && ns.windowClosesIn !== null && (
            <div>
              <span className="text-caption uppercase tracking-wider text-text-faint block mb-0.5">{t("nowClosesIn")}</span>
              <span className="text-body text-text-secondary">{formatCountdown(ns.windowClosesIn)}</span>
            </div>
          )}
          {ns.state === "upcoming" && ns.bestHour !== null && ns.bestMinutes !== null && (
            <div>
              <span className="text-caption uppercase tracking-wider text-text-faint block mb-0.5">{t("nowBestHour")}</span>
              <span className="text-body text-text-secondary">{fmtMin(ns.bestMinutes)} {t("atHour", { hour: `${ns.bestHour}:00` })}</span>
              <span className="text-caption text-text-faint ml-1">{t("forIU", { iu: targetIU })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
