"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useSwipe } from "@/hooks/useSwipe";
import PartnerBadge from "@/components/PartnerBadge";
import { oddDaysOut } from "@/lib/odd-day-out";
import type { DayRecord } from "@/lib/types";

type ViewMode = "week" | "month";

/** A stretch of "you were here", as `useHistory` grouped it. */
export interface LocationSpan {
  name: string;
  cityId: string | null;
  from: string;
  to: string;
  days: number;
  /** Of those days, how many inherited the place rather than recording it. */
  assumedDays: number;
}

interface Props {
  records: DayRecord[];
  /** Where the user was, in stretches. Empty until the window is derived. */
  locations?: LocationSpan[];
  /** Dates whose location was inherited rather than recorded. */
  assumedDates?: string[];
  onToggleOverride: (date: string) => void;
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

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 2024-01-01 is a Monday — a fixed reference so the week always starts Mon..Sun
 *  regardless of when this runs, matching `getMonday()`'s Mon-first convention. */
const REF_MONDAY = new Date(2024, 0, 1);
/** Any mid-month day works as a reference for locale month-name formatting. */
const refMonthDate = (monthIndex: number) => new Date(2024, monthIndex, 15);

type DayStatus = "empty" | "future" | "unfavorable" | "favorable" | "confirmed" | "declined";

function getDayStatus(record: DayRecord | null, isFuture: boolean): DayStatus {
  if (isFuture) return "future";
  if (!record) return "empty";
  if (record.userOverride === true && record.sufficient) return "confirmed";
  // Explicitly answered "no" on a day that did have a window. Neutral, not red:
  // the app tracks what happened, it does not scold anyone for staying in.
  if (record.userOverride === false && record.sufficient) return "declined";
  if (record.sufficient) return "favorable";
  return "unfavorable";
}

// Cell fill + number colour per status. Both views share this — the status is
// read from the FILL (amber = sun window, emerald = you logged sun, neutral =
// no window), the date number always stays visible for reference, and confirmed
// days get a corner check so the meaning survives without relying on colour.
function getCellClasses(status: DayStatus, isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-amber-400/70" : "";
  switch (status) {
    case "confirmed":
      return `bg-emerald-500/35 text-emerald-100 ${ring}`;
    case "declined":
      return `bg-surface-elevated text-text-secondary ring-1 ring-inset ring-amber-400/30 ${ring}`;
    case "favorable":
      return `bg-amber-400/25 text-accent ${ring}`;
    case "unfavorable":
      return `bg-surface-elevated text-text-muted ${ring}`;
    case "future":
      return `text-text-faint/50 ${ring}`;
    default:
      return `text-text-faint ${ring}`;
  }
}

/** Days a stretch covers, inclusive. */
function spanLength(span: { from: string; to: string }): number {
  return Math.round(
    (Date.parse(`${span.to}T00:00:00Z`) - Date.parse(`${span.from}T00:00:00Z`)) / 86400000,
  ) + 1;
}

/** `4 – 19 Julio`, or `21 Julio – 2 Agosto` when the stretch crosses a month. */
function spanDates(span: { from: string; to: string }, monthNames: string[]): string {
  const [, fm, fd] = span.from.split("-").map(Number);
  const [, tm, td] = span.to.split("-").map(Number);
  if (span.from === span.to) return `${fd} ${monthNames[fm - 1]}`;
  if (fm === tm) return `${fd} – ${td} ${monthNames[tm - 1]}`;
  return `${fd} ${monthNames[fm - 1]} – ${td} ${monthNames[tm - 1]}`;
}

/**
 * The stretches that overlap what is on screen, clipped to it.
 *
 * The window is derived three months deep, but the grid shows a week or a month;
 * listing every place of the last ninety days under a single week would say
 * nothing about that week.
 */
function spansInRange(spans: LocationSpan[], from: string, to: string): LocationSpan[] {
  return spans
    .filter((s) => s.from <= to && s.to >= from)
    .map((s) => ({ ...s, from: s.from < from ? from : s.from, to: s.to > to ? to : s.to }));
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

export default function HistoryCalendar({ records, locations = [], assumedDates = [], onToggleOverride }: Props) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const today = new Date();
  const todayStr = toDateStr(today);

  // Localized weekday/month labels — was hardcoded Spanish, showing wrong in
  // EN/FR/DE/RU/LT. Weekday uses "narrow" (single-glyph L/M/X..) for the header
  // row; month uses "long" since headers render e.g. "24–30 Julio" / "24–30 July".
  const dayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(REF_MONDAY);
      d.setDate(d.getDate() + i);
      return fmt.format(d);
    });
  }, [locale]);
  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "long" });
    return Array.from({ length: 12 }, (_, m) => capFirst(fmt.format(refMonthDate(m))));
  }, [locale]);

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

  // Memoised because the location line derives from it: a fresh Date every
  // render would recompute the stretches on every keystroke elsewhere.
  const viewMonday = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 90);

  const canGoBack = viewMode === "week"
    ? viewMonday > minDate
    : new Date(viewYear, viewMonth, 1) > minDate;

  const canGoForward = viewMode === "week"
    ? weekOffset < 0
    : viewYear < today.getFullYear() || viewMonth < today.getMonth();

  const goBack = () => {
    if (!canGoBack) return;
    if (viewMode === "week") {
      setWeekOffset((o) => o - 1);
      return;
    }
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goForward = () => {
    if (!canGoForward) return;
    if (viewMode === "week") {
      setWeekOffset((o) => o + 1);
      return;
    }
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const swipeHandlers = useSwipe(goForward, goBack);


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

  const oddOnes = useMemo(() => oddDaysOut(locations), [locations]);

  // What the location line talks about: the days actually on screen.
  const { visibleSpans, assumedInView, daysInView } = useMemo(() => {
    const from = viewMode === "week"
      ? toDateStr(viewMonday)
      : `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(viewMonday);
    lastDay.setDate(lastDay.getDate() + 6);
    const to = viewMode === "week"
      ? toDateStr(lastDay)
      : `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(daysInMonth(viewYear, viewMonth)).padStart(2, "0")}`;

    const clipped = spansInRange(locations, from, to);
    // Counted by date inside the clip. Scaling a stretch's total down to the
    // visible slice reported seven of seven inherited on a week where every day
    // had in fact been recorded.
    const days = clipped.reduce((n, s) => n + spanLength(s), 0);
    const assumed = assumedDates.filter((d) => d >= from && d <= to).length;
    return { visibleSpans: clipped, assumedInView: assumed, daysInView: days };
  }, [locations, assumedDates, viewMode, viewMonday, viewYear, viewMonth]);

  const headerLabel = viewMode === "week"
    ? (() => {
        const endOfWeek = new Date(viewMonday);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const startDay = viewMonday.getDate();
        const endDay = endOfWeek.getDate();
        if (viewMonday.getMonth() === endOfWeek.getMonth()) {
          return `${startDay}\u{2013}${endDay} ${monthNames[viewMonday.getMonth()]}`;
        }
        return `${startDay} ${monthNames[viewMonday.getMonth()]} \u{2013} ${endDay} ${monthNames[endOfWeek.getMonth()]}`;
      })()
    : `${monthNames[viewMonth]} ${viewYear}`;

  // One cell, shared by both views: a rounded square that always shows the day
  // NUMBER (so every date is identifiable), colours the fill by status, and adds
  // a corner check for confirmed days. The weekday letter lives in the header
  // row above — never inside the cell — which removes the old duplicate-letter
  // and gives the week view real dates instead of a lone glyph.
  function renderDayCell(ds: string, record: DayRecord | null, isFuture: boolean, isToday: boolean, dayNum: number, heightClass: string) {
    const status = getDayStatus(record, isFuture);
    const cellClasses = getCellClasses(status, isToday);
    const canTap = !isFuture && !!record;
    // A day sitting in a different place from the stretches either side of it.
    // The place goes in the label too: a dot nobody can read is decoration.
    const oddPlace = oddOnes.get(ds);

    return (
      <button
        key={ds}
        onClick={() => handleDayTap(ds, record, isFuture)}
        disabled={isFuture || !record}
        data-odd-one={oddPlace || undefined}
        aria-label={oddPlace ? `${ds} · ${oddPlace}` : ds}
        className={`relative flex items-center justify-center rounded-xl ${heightClass} transition-colors ${cellClasses} ${
          oddPlace ? "ring-1 ring-inset ring-sky-300/60" : ""
        } ${canTap ? "cursor-pointer active:scale-95" : "cursor-default"}`}
      >
        <span className="font-mono text-body font-semibold leading-none">{dayNum}</span>
        {status === "confirmed" && (
          <Check className="absolute right-1 top-1 h-3 w-3 text-emerald-200" strokeWidth={3} aria-hidden />
        )}
        {oddPlace && (
          <span
            className="absolute left-1 bottom-1 h-1.5 w-1.5 rounded-full bg-sky-300"
            aria-hidden
          />
        )}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-md p-4 shadow-lg" {...swipeHandlers}>
      {/* Header — two rows on mobile (tabs above, time nav below) so the
          segmented control + arrows + label never overflow a 390px viewport;
          single row from sm up. */}
      <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-surface-elevated p-1 self-start">
          <button
            onClick={() => setViewMode("week")}
            className={`min-h-[44px] px-4 rounded-lg text-caption font-semibold transition-colors ${
              viewMode === "week" ? "bg-amber-400/25 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t("week")}
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`min-h-[44px] px-4 rounded-lg text-caption font-semibold transition-colors ${
              viewMode === "month" ? "bg-amber-400/25 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t("month")}
          </button>
        </div>

        <div className="flex items-center justify-between gap-1 sm:justify-end">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            aria-label={t("calPrev")}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated disabled:opacity-20 disabled:cursor-default transition-colors"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="text-body font-medium text-text-secondary min-w-[130px] text-center">{headerLabel}</span>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            aria-label={t("calNext")}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated disabled:opacity-20 disabled:cursor-default transition-colors"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Weekday header row — shared by both views, so week cells no longer carry
          their own letter (that was the duplicate-letter bug). */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {dayLabels.map((label, i) => (
          <div key={`${label}-${i}`} className="text-center text-caption text-text-faint font-semibold uppercase">{label}</div>
        ))}
      </div>

      {/* Week view */}
      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(viewMonday);
            d.setDate(d.getDate() + i);
            const ds = toDateStr(d);
            const record = records.find((r) => r.date === ds) ?? null;
            const isFuture = d > today;
            const isToday = ds === todayStr;
            return renderDayCell(ds, record, isFuture, isToday, d.getDate(), "h-14");
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
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="h-12" />;

              const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const d = new Date(viewYear, viewMonth, day);
              const record = records.find((r) => r.date === ds) ?? null;
              const isFuture = d > today;
              const isToday = ds === todayStr;
              return renderDayCell(ds, record, isFuture, isToday, day, "h-12");
            })}
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
          <>
            <p className="text-xs text-accent/50">
              {t("supplementHint")}
            </p>
            <PartnerBadge className="mt-1" />
          </>
        )}
      </div>

      {/* Feedback or legend */}
      {feedbackMsg ? (
        <p className="text-caption text-accent/70 mt-2 text-center animate-pulse">{feedbackMsg}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3 text-caption text-text-faint">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-md bg-amber-400/25" />
            {t("legendFavorable")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex w-3 h-3 rounded-md bg-emerald-500/35 items-center justify-center">
              <Check className="h-2 w-2 text-emerald-200" strokeWidth={3} aria-hidden />
            </span>
            {t("legendConfirmed")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-md bg-surface-elevated ring-1 ring-inset ring-amber-400/30" />
            {t("legendDeclined")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-md bg-surface-elevated" />
            {t("legendUnfavorable")}
          </span>
        </div>
      )}

      {/*
        Where you were, under the grid rather than inside it: it is a different
        question from how the day went, so it does not belong in the cell
        colours. A sentence rather than a proportional bar, because a one-day
        stretch between two fortnights collapses into an unreadable sliver in a
        bar and reads as "20 jul" in a sentence — and it wraps on a phone.
      */}
      {visibleSpans.length > 0 && (
        <div className="mt-3 border-t border-glass-border pt-3 text-caption text-text-muted">
          <span className="uppercase tracking-wider text-text-faint">{t("whereYouWere")}</span>
          <p className="mt-1 text-text-secondary">
            {"\u{1F4CD} "}
            {visibleSpans.map((s, i) => (
              <span key={`${s.from}-${s.cityId}`}>
                {i > 0 && <span className="text-text-faint"> · </span>}
                {s.name} <span className="text-text-faint">{spanDates(s, monthNames)}</span>
              </span>
            ))}
          </p>
          {assumedInView > 0 && (
            <p className="mt-1 text-text-faint">
              {t("locationAssumedNote", { assumed: assumedInView, total: daysInView })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
