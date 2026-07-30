import { historyStrings } from "./i18n";
import type { HistoryMeta } from "./data";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const COLORS = {
  confirmed: "#ffb020",
  viable: "rgba(255,176,32,0.28)",
  missed: "rgba(255,255,255,0.10)",
  pending: "rgba(255,255,255,0.05)",
};

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
    const color = day.wentOutside ? COLORS.confirmed : day.viableSun ? COLORS.viable : COLORS.missed;
    const label = `${day.date} — ${day.wentOutside ? copy.confirmed : day.viableSun ? copy.viable : copy.missed}`;
    return `<button type="button" data-date="${day.date}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" `
      + `aria-pressed="${day.wentOutside}" `
      + `style="width:100%;aspect-ratio:1;border:0;border-radius:6px;cursor:pointer;padding:0;`
      + `background:${isPending ? COLORS.pending : color};`
      + `${isPending ? "animation:pulse 1s ease-in-out infinite;" : ""}"></button>`;
  }).join("");

  const weekdays = copy.weekdays
    .map((d) => `<span style="text-align:center;font-size:10px;color:${p.onPlateFaint}">${escapeHtml(d)}</span>`)
    .join("");

  return [
    `<style>@keyframes pulse{50%{opacity:.45}}</style>`,
    `<figure style="margin:0;font-family:system-ui,sans-serif;color:${p.text}">`,
    `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px">`,
    `<span style="font-size:15px;font-weight:650">${escapeHtml(copy.title)}</span>`,
    `<span style="font-size:12px;color:${p.muted}">`,
    `<strong style="color:${COLORS.confirmed}">${meta.streak}</strong> ${escapeHtml(copy.streak)}`,
    ` · ${meta.daysTracked} ${escapeHtml(copy.tracked)}</span>`,
    `</div>`,
    `<div id="history-grid" style="background:${p.plate};border-radius:12px;padding:10px">`,
    `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">${weekdays}</div>`,
    `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${blanks}${cells}</div>`,
    `</div>`,
    `<figcaption style="margin-top:8px;font-size:12px;color:${p.muted}">${escapeHtml(copy.tapHint)}</figcaption>`,
    `</figure>`,
  ].join("");
}
