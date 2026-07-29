import { HEAT_LEGEND_GRADIENT, yearStripColumns, yearStripViewBox } from "@/lib/year-strip";
import { widgetMonthLabels, widgetStrings } from "./i18n";
import { widgetPalette } from "./theme";

export interface RenderYearStripOptions { hoursByDay: number[] | null; locale?: unknown; theme?: unknown }

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function renderYearStrip({ hoursByDay, locale, theme }: RenderYearStripOptions): string {
  const copy = widgetStrings(locale);
  const palette = widgetPalette(theme);
  if (!hoursByDay) {
    return `<p style="margin:0;color:${palette.textMuted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }
  const bars = yearStripColumns(hoursByDay)
    .map((c) => `<rect x="${c.x}" y="0" width="${c.width}" height="110" fill="${c.fill}"/>`).join("");
  const months = widgetMonthLabels(locale).map((m) => `<span>${escapeHtml(m)}</span>`).join("");
  return [
    `<figure style="margin:0;color:${palette.textPrimary};font-family:system-ui,sans-serif">`,
    `<div style="padding:12px;border-radius:12px;background:${palette.plate}">`,
    `<svg viewBox="${yearStripViewBox(hoursByDay.length, 110)}" width="100%" height="110" role="img" aria-label="${escapeHtml(copy.caption)}" preserveAspectRatio="none">${bars}</svg>`,
    `<div style="display:grid;grid-template-columns:repeat(12,1fr);margin-top:6px;color:${palette.onPlateFaint};font-size:11px">${months}</div>`,
    `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;color:${palette.onPlateFaint};font-size:11px"><span>${escapeHtml(copy.legendLow)}</span><span style="height:8px;flex:1;border-radius:99px;background:${HEAT_LEGEND_GRADIENT}"></span><span>${escapeHtml(copy.legendHigh)}</span></div>`,
    `</div><figcaption style="margin-top:8px;color:${palette.textMuted};font-size:12px;line-height:1.4">${escapeHtml(copy.caption)}</figcaption></figure>`,
  ].join("");
}
