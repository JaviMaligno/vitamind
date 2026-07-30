import { historyStrings } from "./i18n";
import { monthLabel } from "../shared/months";
import type { HistoryMeta } from "./data";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/**
 * Same colour language as the app's own calendar: emerald means you logged sun,
 * amber means the day had a window, neutral means it did not. "Stayed in" is
 * neutral with an amber outline — the window was there, the answer was no. It is
 * deliberately not red: this tracks what happened, it does not scold anyone.
 */
const COLORS = {
  confirmed: "rgba(16,185,129,0.55)",
  viable: "rgba(255,176,32,0.28)",
  declined: "rgba(255,255,255,0.07)",
  missed: "rgba(255,255,255,0.10)",
  pending: "rgba(255,255,255,0.05)",
};

const INK = {
  confirmed: "#04231a",
  viable: "rgba(255,255,255,0.86)",
  declined: "rgba(255,255,255,0.7)",
  missed: "rgba(255,255,255,0.45)",
};

const OUTLINE = {
  confirmed: "none",
  viable: "none",
  declined: "inset 0 0 0 1px rgba(255,176,32,0.45)",
  missed: "none",
};

export type CellState = "confirmed" | "viable" | "declined" | "missed";

/** The four appearances, from the day's sun and the user's answer. */
export function cellState(day: { viableSun: boolean; wentOutside: boolean | null }): CellState {
  if (day.wentOutside === true) return "confirmed";
  if (day.wentOutside === false && day.viableSun) return "declined";
  return day.viableSun ? "viable" : "missed";
}

const palette = (theme: unknown) => ({
  text: theme === "dark" ? "var(--color-text-primary, #f4f5f7)" : "var(--color-text-primary, #17191f)",
  muted: theme === "dark" ? "var(--color-text-secondary, #a8adb8)" : "var(--color-text-secondary, #646b78)",
  plate: "#0a0f28",
  onPlateFaint: "rgba(255,255,255,0.55)",
});

export interface RenderHistoryOptions {
  meta: HistoryMeta | null;
  /** Days the user just tapped, still waiting for the server to confirm. */
  pending?: string[];
  locale?: unknown;
  theme?: unknown;
}

/** Weekday index with Monday first, from a YYYY-MM-DD string, read in UTC. */
export function weekdayIndex(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day + 6) % 7;
}

/** Day-of-month and 0-based month, straight off the string — no Date, no zone. */
export function dayParts(date: string): { day: number; month: number } {
  const [, month, day] = date.split("-");
  return { day: Number(day), month: Number(month) - 1 };
}

/**
 * What a cell prints: the day number, except on the first of a month, where the
 * month's name takes its place.
 *
 * That was the gap: a grid of unlabelled squares is readable only if you already
 * trust it. The number tells you which days you are looking at, and the month
 * name where the grid crosses into a new one tells you which month, without
 * spending a whole row on a header.
 */
export function cellLabel(date: string, locale: unknown): string {
  const { day, month } = dayParts(date);
  return day === 1 ? monthLabel(locale, month) : String(day);
}

export function renderHistory({ meta, pending = [], locale, theme }: RenderHistoryOptions): string {
  const copy = historyStrings(locale);
  const p = palette(theme);

  if (!meta) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  if (!meta.authenticated) {
    // The tool's own answer in this case is `authentication_required`; the widget
    // mirrors it rather than rendering an empty grid that looks like "no sun ever".
    return [
      `<div style="margin:0;font-family:system-ui,sans-serif;color:${p.text}">`,
      `<div style="font-size:15px;font-weight:600;margin-bottom:4px">${escapeHtml(copy.signedOut)}</div>`,
      `<div style="font-size:13px;line-height:1.5;color:${p.muted}">${escapeHtml(copy.signedOutHint)}</div>`,
      `</div>`,
    ].join("");
  }

  const days = [...meta.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (days.length === 0) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  // Pad the first week so columns line up with weekdays.
  const lead = weekdayIndex(days[0].date);
  const blanks = Array.from({ length: lead }, () => `<span></span>`).join("");

  const cells = days.map((day) => {
    const isPending = pending.includes(day.date);
    const state = cellState(day);
    const stateWord = state === "confirmed" ? copy.confirmed
      : state === "declined" ? copy.declined
        : state === "viable" ? copy.viable : copy.missed;
    const label = `${day.date} — ${stateWord}`;
    const text = cellLabel(day.date, locale);
    const isMonthStart = dayParts(day.date).day === 1;
    return `<button type="button" data-date="${day.date}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" `
      + `aria-pressed="${day.wentOutside === true}" `
      // A day with no usable sun is not answerable, exactly as in the app.
      + `${day.viableSun ? "" : "disabled "}`
      + `style="width:100%;aspect-ratio:1;border:0;border-radius:6px;padding:0;`
      + `cursor:${day.viableSun ? "pointer" : "default"};box-shadow:${OUTLINE[state]};`
      + `display:flex;align-items:center;justify-content:center;`
      + `font:${isMonthStart ? "600 9px" : "500 11px"}/1 system-ui,sans-serif;`
      + `color:${isPending ? "transparent" : INK[state]};`
      + `background:${isPending ? COLORS.pending : COLORS[state]};`
      + `${isPending ? "animation:pulse 1s ease-in-out infinite;" : ""}">${escapeHtml(text)}</button>`;
  }).join("");

  // The span the grid covers, spelled out above it. Reassurance that the squares
  // are the days you think they are costs one line.
  const first = dayParts(days[0].date);
  const last = dayParts(days[days.length - 1].date);
  const range = `${first.day} ${monthLabel(locale, first.month)} – ${last.day} ${monthLabel(locale, last.month)}`;

  // Four swatches: what the colours mean, in the widget rather than in a caption
  // someone has to remember. Without it the grid is a code you have to crack.
  const legend = ([
    ["confirmed", copy.confirmed],
    ["declined", copy.declined],
    ["viable", copy.viable],
    ["missed", copy.missed],
  ] as Array<[CellState, string]>).map(([state, text]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px">`
    + `<span style="width:10px;height:10px;border-radius:3px;background:${COLORS[state]};box-shadow:${OUTLINE[state]}"></span>`
    + `${escapeHtml(text)}</span>`).join("");

  const weekdays = copy.weekdays
    .map((d) => `<span style="text-align:center;font-size:10px;color:${p.onPlateFaint}">${escapeHtml(d)}</span>`)
    .join("");

  return [
    `<style>@keyframes pulse{50%{opacity:.45}}</style>`,
    `<figure style="margin:0;font-family:system-ui,sans-serif;color:${p.text}">`,
    `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px">`,
    `<span style="font-size:15px;font-weight:650">${escapeHtml(copy.title)}`
      + ` <span style="font-weight:400;font-size:12px;color:${p.muted}">${escapeHtml(range)}</span></span>`,
    `<span style="font-size:12px;color:${p.muted}">`,
    `<strong style="color:${COLORS.confirmed}">${meta.streak}</strong> ${escapeHtml(copy.streak)}`,
    ` · ${meta.daysTracked} ${escapeHtml(copy.tracked)}</span>`,
    `</div>`,
    `<div id="history-grid" style="background:${p.plate};border-radius:12px;padding:10px">`,
    `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">${weekdays}</div>`,
    `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${blanks}${cells}</div>`,
    `</div>`,
    `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:11px;color:${p.muted}">${legend}</div>`,
    `<figcaption style="margin-top:6px;font-size:12px;color:${p.muted}">${escapeHtml(copy.tapHint)}</figcaption>`,
    `</figure>`,
  ].join("");
}
