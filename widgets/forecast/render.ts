import { skyIcon, weekdayIndex, dayOfMonth, type ForecastDay, type ForecastMeta } from "./data";
import { forecastStrings } from "./i18n";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const palette = (theme: unknown) => ({
  text: theme === "dark" ? "var(--color-text-primary, #f4f5f7)" : "var(--color-text-primary, #17191f)",
  muted: theme === "dark" ? "var(--color-text-secondary, #a8adb8)" : "var(--color-text-secondary, #646b78)",
  plate: "#0a0f28",
  onPlate: "rgba(255,255,255,0.92)",
  onPlateFaint: "rgba(255,255,255,0.55)",
  best: "#ffb020",
  row: "rgba(255,255,255,0.04)",
  rowBest: "rgba(255,176,32,0.12)",
});

const interpolate = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`);

/**
 * How to name a day in a row someone scans: "today", "tomorrow", then the
 * weekday. A date is precise and unreadable at a glance; a weekday is what
 * people actually plan around.
 */
export function dayLabel(date: string, index: number, locale: unknown): string {
  const copy = forecastStrings(locale);
  if (index === 0) return copy.today;
  if (index === 1) return copy.tomorrow;
  return copy.weekdays[weekdayIndex(date)];
}

/**
 * The answer, before the rows.
 *
 * Naming a best day is only useful when there is something to choose. On a week
 * where every day works, "best day: Friday" reads as a reason to wait — the
 * opposite of the advice — so it says that any day will do and to go today.
 */
export function headline(meta: ForecastMeta, locale: unknown): string {
  const copy = forecastStrings(locale);
  if (!meta.bestDay) return copy.noSun;

  const usable = meta.days.filter((d) => d.synthesisPossible);
  if (usable.length === meta.days.length && meta.days.length > 1) return copy.anyDay;

  const index = meta.days.findIndex((d) => d.date === meta.bestDay);
  if (index === 0) return copy.bestIsToday;
  return interpolate(copy.bestIs, { day: dayLabel(meta.bestDay, index, locale) });
}

function row(day: ForecastDay, index: number, locale: unknown, isBest: boolean, p: ReturnType<typeof palette>): string {
  const copy = forecastStrings(locale);
  const label = dayLabel(day.date, index, locale);
  const detail = day.synthesisPossible && day.windowStart && day.windowEnd
    ? `${day.windowStart}–${day.windowEnd}${day.minutesNeeded !== null ? ` · ${day.minutesNeeded} min` : ""}`
    : copy.noWindow;

  return `<div style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;`
    + `background:${isBest ? p.rowBest : p.row};${isBest ? `box-shadow:inset 0 0 0 1px ${p.best};` : ""}">`
    + `<span style="width:56px;flex:none;font-size:13px;font-weight:${isBest ? 650 : 500};color:${isBest ? p.best : p.onPlate}">`
    + `${escapeHtml(label)}<span style="font-weight:400;color:${p.onPlateFaint}"> ${dayOfMonth(day.date)}</span></span>`
    + `<span style="font-size:16px;flex:none" role="img" aria-label="${day.avgCloudPercent}%">${skyIcon(day.avgCloudPercent, day.peakUVIndex)}</span>`
    + `<span style="width:52px;flex:none;font-size:13px;color:${p.onPlate}">UV ${day.peakUVIndex}</span>`
    + `<span style="flex:1;font-size:13px;color:${day.synthesisPossible ? p.onPlate : p.onPlateFaint};text-align:right">${escapeHtml(detail)}</span>`
    + `</div>`;
}

export interface RenderForecastOptions {
  meta: ForecastMeta | null;
  locale?: unknown;
  theme?: unknown;
}

/**
 * A row per day, not a chart.
 *
 * The question is "which day should I go out?", and the answer is a name. A
 * multi-day UV chart would make the reader compare bar heights to recover a
 * decision the server already made — see docs/widget-design.md.
 */
export function renderForecast({ meta, locale, theme }: RenderForecastOptions): string {
  const p = palette(theme);
  const copy = forecastStrings(locale);

  if (!meta) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  const rows = meta.days
    .map((d, i) => row(d, i, locale, d.date === meta.bestDay, p))
    .join("");

  return [
    `<figure style="margin:0;font-family:system-ui,sans-serif;color:${p.text}">`,
    `<div style="border-radius:16px;background:${p.plate};padding:14px">`,
    `<div style="font-size:17px;font-weight:650;color:${p.onPlate};margin-bottom:10px">${escapeHtml(headline(meta, locale))}</div>`,
    `<div style="display:flex;flex-direction:column;gap:5px">${rows}</div>`,
    `</div>`,
    `<figcaption style="margin-top:8px;font-size:12px;color:${p.muted}">${escapeHtml(copy.title)}</figcaption>`,
    `</figure>`,
  ].join("");
}
