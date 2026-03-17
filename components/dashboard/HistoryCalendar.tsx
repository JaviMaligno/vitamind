"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useSwipe } from "@/hooks/useSwipe";
import type { DayRecord } from "@/lib/types";

type ViewMode = "week" | "month";

interface Props {
  records: DayRecord[];
  onToggleOverride: (date: string) => void;
  onNavigate: (startStr: string, endStr: string) => void;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type DayStatus = "empty" | "future" | "unfavorable" | "favorable" | "confirmed";

function getDayStatus(record: DayRecord | null, isFuture: boolean): DayStatus {
  if (isFuture) return "future";
  if (!record) return "empty";
  if (record.userOverride === true && record.sufficient) return "confirmed";
  if (record.sufficient) return "favorable";
  return "unfavorable";
}

function getCellClasses(status: DayStatus, isToday: boolean): string {
  const todayBorder = isToday ? "ring-2 ring-amber-400/50" : "";

  switch (status) {
    case "confirmed":
      return `bg-emerald-500/40 ${todayBorder}`;
    case "favorable":
      return `bg-amber-400/25 ${todayBorder}`;
    case "unfavorable":
      return `bg-surface-elevated ${todayBorder}`;
    case "future":
      return "opacity-25";
    default:
      return `bg-transparent ${todayBorder}`;
  }
}

function getCellIcon(status: DayStatus): string | null {
  switch (status) {
    case "confirmed": return "\u2713";    // checkmark
    case "favorable": return "\u25cb";    // open circle (pending)
    case "unfavorable": return "\u2014";  // em dash
    default: return null;
  }
}

function computeSummary(records: DayRecord[]): { favorable: number; total: number; confirmed: number } {
  let favorable = 0;
  let confirmed = 0;
  for (const r of records) {
    if (r.sufficient) {
      favorable++;
      if (r.userOverride === true) confirmed++;
    }
  }
  return { favorable, total: records.length, confirmed };
}

export default function HistoryCalendar({ records, onToggleOverride, onNavigate }: Props) {
  const t = useTranslations("dashboard");
  const today = new Date();
  const todayStr = toDateStr(today);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFeedback = useCallback((msg: string) => {
    clearTimeout(feedbackTimer.current);
    setFeedbackMsg(msg);
    feedbackTimer.current = setTimeout(() => setFeedbackMsg(null), 2000);
  }, []);

  const handleDayTap = useCallback((date: string, record: DayRecord | null, isFuture: boolean) => {
    if (isFuture || !record) return;
    if (!record.sufficient) {
      showFeedback(t("noConditionsTap"));
      return;
    }
    onToggleOverride(date);
  }, [onToggleOverride, showFeedback, t]);

  const currentMonday = getMonday(today);
  const viewMonday = new Date(currentMonday);
  viewMonday.setDate(viewMonday.getDate() + weekOffset * 7);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 90);

  const canGoBack = viewMode === "week"
    ? viewMonday > minDate
    : new Date(viewYear, viewMonth, 1) > minDate;

  const canGoForward = viewMode === "week"
    ? weekOffset < 0
    : viewYear < today.getFullYear() || viewMonth < today.getMonth();

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    if (viewMode === "week") {
      setWeekOffset((o) => o - 1);
    } else {
      setViewMonth((m) => {
        if (m === 0) { setViewYear((y) => y - 1); return 11; }
        return m - 1;
      });
    }
  }, [canGoBack, viewMode]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    if (viewMode === "week") {
      setWeekOffset((o) => o + 1);
    } else {
      setViewMonth((m) => {
        if (m === 11) { setViewYear((y) => y + 1); return 0; }
        return m + 1;
      });
    }
  }, [canGoForward, viewMode]);

  const swipeHandlers = useSwipe(goForward, goBack);

  useEffect(() => {
    if (viewMode === "week") {
      const start = toDateStr(viewMonday);
      const endDate = new Date(viewMonday);
      endDate.setDate(endDate.getDate() + 6);
      onNavigate(start, toDateStr(endDate));
    } else {
      const start = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
      const lastDay = daysInMonth(viewYear, viewMonth);
      const end = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      onNavigate(start, end);
    }
  }, [viewMode, weekOffset, viewYear, viewMonth, onNavigate]);

  const viewRecords = viewMode === "week"
    ? (() => {
        const recs: DayRecord[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(viewMonday);
          d.setDate(d.getDate() + i);
          const ds = toDateStr(d);
          const r = records.find((rec) => rec.date === ds);
          if (r) recs.push(r);
        }
        return recs;
      })()
    : records.filter((r) => {
        const d = new Date(r.date + "T12:00:00");
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      });

  const summary = computeSummary(viewRecords);

  const headerLabel = viewMode === "week"
    ? (() => {
        const endOfWeek = new Date(viewMonday);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const startDay = viewMonday.getDate();
        const endDay = endOfWeek.getDate();
        if (viewMonday.getMonth() === endOfWeek.getMonth()) {
          return `${startDay}\u{2013}${endDay} ${MONTH_NAMES[viewMonday.getMonth()]}`;
        }
        return `${startDay} ${MONTH_NAMES[viewMonday.getMonth()]} \u{2013} ${endDay} ${MONTH_NAMES[endOfWeek.getMonth()]}`;
      })()
    : `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  function renderDayCell(ds: string, record: DayRecord | null, isFuture: boolean, isToday: boolean, label: string | number, shape: "circle" | "square") {
    const status = getDayStatus(record, isFuture);
    const cellClasses = getCellClasses(status, isToday);
    const icon = getCellIcon(status);
    const canTap = !isFuture && !!record;
    const isRound = shape === "circle";

    return (
      <button
        key={ds}
        onClick={() => handleDayTap(ds, record, isFuture)}
        disabled={!canTap}
        className={`flex flex-col items-center justify-center ${isRound ? "rounded-full w-10 h-10" : "rounded-md h-8"} flex-shrink-0 transition-colors ${cellClasses} ${
          canTap ? "cursor-pointer active:scale-95" : "cursor-default"
        }`}
      >
        <span className={`text-[10px] font-medium ${status === "confirmed" ? "text-emerald-300" : status === "favorable" ? "text-amber-400" : "text-text-secondary"}`}>
          {isRound && icon ? icon : label}
        </span>
        {isRound && (
          <span className="text-[8px] text-text-faint leading-none">{label}</span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-4" {...swipeHandlers}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("week")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === "week" ? "bg-amber-400/20 text-amber-400" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t("week")}
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewMode === "month" ? "bg-amber-400/20 text-amber-400" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t("month")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="text-text-muted hover:text-text-secondary disabled:opacity-20 disabled:cursor-default text-sm px-1"
          >
            {"\u2039"}
          </button>
          <span className="text-xs text-text-secondary min-w-[120px] text-center">{headerLabel}</span>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="text-text-muted hover:text-text-secondary disabled:opacity-20 disabled:cursor-default text-sm px-1"
          >
            {"\u203a"}
          </button>
        </div>
      </div>

      {/* Week view */}
      {viewMode === "week" && (
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(viewMonday);
            d.setDate(d.getDate() + i);
            const ds = toDateStr(d);
            const record = records.find((r) => r.date === ds) ?? null;
            const isFuture = d > today;
            const isToday = ds === todayStr;
            return renderDayCell(ds, record, isFuture, isToday, DAY_LABELS[i], "circle");
          })}
        </div>
      )}

      {/* Month view */}
      {viewMode === "month" && (() => {
        const totalDays = daysInMonth(viewYear, viewMonth);
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const cells: (number | null)[] = [];

        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= totalDays; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((label) => (
                <div key={label} className="text-center text-[9px] text-text-faint font-medium">{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="h-8" />;

                const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const d = new Date(viewYear, viewMonth, day);
                const record = records.find((r) => r.date === ds) ?? null;
                const isFuture = d > today;
                const isToday = ds === todayStr;
                return renderDayCell(ds, record, isFuture, isToday, day, "square");
              })}
            </div>
          </div>
        );
      })()}

      {/* Summary */}
      <div className="mt-3 space-y-1">
        {summary.favorable > 0 && (
          <p className="text-sm text-text-secondary">
            {t("favorableSummary", { count: summary.favorable, total: summary.total })}
          </p>
        )}
        {summary.confirmed > 0 && (
          <p className="text-xs text-emerald-400/60">
            {t("confirmedCount", { count: summary.confirmed })}
          </p>
        )}
        {summary.total >= 7 && summary.favorable < summary.total * 0.4 && (
          <p className="text-xs text-amber-400/50">
            {t("supplementHint")}
          </p>
        )}
      </div>

      {/* Feedback or legend */}
      {feedbackMsg ? (
        <p className="text-[10px] text-amber-400/70 mt-2 text-center animate-pulse">{feedbackMsg}</p>
      ) : (
        <div className="flex items-center justify-center gap-4 mt-3 text-[9px] text-text-faint">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400/25" />
            {t("legendFavorable")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/40" />
            {t("legendConfirmed")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-surface-elevated" />
            {t("legendUnfavorable")}
          </span>
        </div>
      )}
    </div>
  );
}
