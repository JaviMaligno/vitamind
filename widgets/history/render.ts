import { historyStrings } from "./i18n";
import { monthLabel } from "../shared/months";
import { datesBetween, type HistoryMeta } from "./data";
import { oddDaysOut } from "../../lib/odd-day-out";

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
  // Fainter than "no viable sun": that is a finding about the day, this is the
  // absence of one.
  unlogged: "rgba(255,255,255,0.035)",
  pending: "rgba(255,255,255,0.05)",
};

const INK = {
  confirmed: "#04231a",
  viable: "rgba(255,255,255,0.86)",
  declined: "rgba(255,255,255,0.7)",
  missed: "rgba(255,255,255,0.45)",
  unlogged: "rgba(255,255,255,0.22)",
};

const OUTLINE = {
  confirmed: "none",
  viable: "none",
  declined: "inset 0 0 0 1px rgba(255,176,32,0.45)",
  missed: "none",
  unlogged: "none",
};

export type CellState = "confirmed" | "viable" | "declined" | "missed" | "unlogged";

/**
 * The five appearances, from the day's sun and the user's answer.
 *
 * `unlogged` is not a verdict but the absence of one: the day could not be
 * placed anywhere, so nothing can be said about its sun. It used to cover every
 * day the app was not opened, which was most of them; the server now works
 * those out, so this is the rare residue.
 */
export function cellState(day: { viableSun: boolean; wentOutside: boolean | null; known?: boolean }): CellState {
  if (day.known === false) return "unlogged";
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

/**
 * `12 jul` for one day, `4 – 19 jul` within a month, `21 jul – 2 ago` across one.
 * The month is named once when it does not change: "4 jul – 19 jul" spends a word
 * on saying the same thing twice.
 */
function spanDates(from: string, to: string, locale: unknown): string {
  const a = dayParts(from);
  const b = dayParts(to);
  const month = (m: number) => monthLabel(locale, m);
  if (from === to) return `${a.day} ${month(a.month)}`;
  if (a.month === b.month) return `${a.day} – ${b.day} ${month(b.month)}`;
  return `${a.day} ${month(a.month)} – ${b.day} ${month(b.month)}`;
}

/**
 * Where you were, under the grid.
 *
 * Deliberately a sentence and not a proportional bar: on real data one stretch
 * was a single day between two fortnights, and a bar collapses that into an
 * unreadable sliver, while a sentence just says "20 jul". It also wraps on a
 * 390px screen instead of truncating.
 *
 * And deliberately not a marker inside the cells: 18 of 30 days inherit their
 * location, so a per-cell dot would cover 60% of the grid and mean nothing.
 */
function locationLine(meta: HistoryMeta, locale: unknown, copy: ReturnType<typeof historyStrings>, p: { muted: string }): string {
  const spans = meta.locations ?? [];
  if (spans.length === 0) return "";

  const total = spans.reduce((n, s) => n + s.days, 0);
  const assumed = spans.reduce((n, s) => n + s.assumedDays, 0);

  const parts = spans.map((s) =>
    `<button type="button" data-span-from="${s.from}" data-span-to="${s.to}" `
    + `title="${escapeHtml(`${s.name} · ${spanDates(s.from, s.to, locale)}`)}" `
    + `style="border:0;background:none;padding:2px 0;margin:0;cursor:pointer;font:inherit;color:#bfdbfe;`
    + `border-bottom:1px dotted rgba(191,219,254,0.45)">${escapeHtml(s.name)} `
    + `<span style="color:${p.muted}">${escapeHtml(spanDates(s.from, s.to, locale))}</span></button>`,
  ).join(`<span style="color:${p.muted};margin:0 6px">·</span>`);

  // The caveat only when there is something to caveat: someone who opens the app
  // daily has nothing to correct, and a permanent note would describe a problem
  // they do not have.
  const note = assumed > 0
    ? `<div style="margin-top:3px;font-size:11px;color:${p.muted}">`
      + escapeHtml(interpolate(copy.assumedNote, { assumed: String(assumed), total: String(total) }))
      + `</div>`
    : "";

  return `<div style="margin-top:10px;font:12px/1.7 system-ui,sans-serif">`
    + `<div style="font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:${p.muted};margin-bottom:2px">${escapeHtml(copy.whereLabel)}</div>`
    + `<div>\u{1F4CD} ${parts}</div>${note}</div>`;
}

/** Fills `{assumed}` / `{total}` the way next-intl would, without shipping it. */
function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`);
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

  const logged = [...meta.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (logged.length === 0 && !meta.from) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  /**
   * One cell per calendar day, not per record. Records exist only for days the
   * app was opened, so chaining them made a sparse history look dense: a span of
   * 104 days drew as 30 adjacent squares, reading as a single month, with every
   * column after the first gap sitting under the wrong weekday.
   */
  const byDate = new Map(logged.map((d) => [d.date, d]));
  const from = meta.from ?? logged[0].date;
  const to = meta.to ?? logged[logged.length - 1].date;
  const days = datesBetween(from, to).map(
    (date) => byDate.get(date) ?? { date, viableSun: false, wentOutside: null, known: false },
  );
  if (days.length === 0) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  // Pad the first week so columns line up with weekdays.
  const lead = weekdayIndex(days[0].date);
  const blanks = Array.from({ length: lead }, () => `<span></span>`).join("");

  const oddOnes = oddDaysOut(meta.locations);

  const cells = days.map((day) => {
    const isPending = pending.includes(day.date);
    const oddPlace = oddOnes.get(day.date);
    const state = cellState(day);
    const stateWord = state === "confirmed" ? copy.confirmed
      : state === "declined" ? copy.declined
        : state === "viable" ? copy.viable
          : state === "unlogged" ? copy.unlogged : copy.missed;
    // The place goes in the label too: a dot nobody can name is decoration.
    const label = oddPlace ? `${day.date} — ${stateWord} · ${oddPlace}` : `${day.date} — ${stateWord}`;
    const text = cellLabel(day.date, locale);
    const isMonthStart = dayParts(day.date).day === 1;
    return `<button type="button" data-date="${day.date}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" `
      + `${oddPlace ? `data-odd-one="${escapeHtml(oddPlace)}" ` : ""}`
      + `aria-pressed="${day.wentOutside === true}" `
      // A day with no usable sun is not answerable, exactly as in the app.
      + `${day.viableSun && state !== "unlogged" ? "" : "disabled "}`
      + `style="position:relative;width:100%;aspect-ratio:1;border:0;border-radius:6px;padding:0;`
      + `cursor:${day.viableSun && state !== "unlogged" ? "pointer" : "default"};box-shadow:${OUTLINE[state]};`
      + `display:flex;align-items:center;justify-content:center;`
      + `font:${isMonthStart ? "600 9px" : "500 11px"}/1 system-ui,sans-serif;`
      + `color:${isPending ? "transparent" : INK[state]};`
      + `background:${isPending ? COLORS.pending : COLORS[state]};`
      + `${isPending ? "animation:pulse 1s ease-in-out infinite;" : ""}`
      + `${oddPlace ? "box-shadow:inset 0 0 0 1px rgba(147,197,253,0.65);" : ""}">${escapeHtml(text)}`
      + `${oddPlace ? `<span style="position:absolute;left:3px;bottom:3px;width:4px;height:4px;border-radius:50%;background:#93c5fd"></span>` : ""}`
      + `</button>`;
  }).join("");

  // The span the grid covers, spelled out above it. Reassurance that the squares
  // are the days you think they are costs one line.
  const first = dayParts(days[0].date);
  const last = dayParts(days[days.length - 1].date);
  const range = `${first.day} ${monthLabel(locale, first.month)} – ${last.day} ${monthLabel(locale, last.month)}`;

  // Five swatches: what the colours mean, in the widget rather than in a caption
  // someone has to remember. Without it the grid is a code you have to crack.
  const legend = ([
    ["confirmed", copy.confirmed],
    ["declined", copy.declined],
    ["viable", copy.viable],
    ["missed", copy.missed],
    ["unlogged", copy.unlogged],
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
    locationLine(meta, locale, copy, p),
    `</figure>`,
  ].join("");
}
