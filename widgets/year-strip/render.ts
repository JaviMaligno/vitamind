import { HEAT_LEGEND_GRADIENT, yearStripColumns, yearStripViewBox } from "@/lib/year-strip";
import { widgetMonthLabels, widgetStrings } from "./i18n";
import { widgetPalette } from "./theme";
import type { YearStripPlace } from "./data";

export interface RenderYearStripOptions {
  places: YearStripPlace[] | null;
  locale?: unknown;
  theme?: unknown;
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/**
 * A single strip is tall enough to read on its own; stacked for a comparison
 * they shrink, because the point there is the shape of one year against another,
 * not the texture of any single one.
 */
const stripHeight = (count: number) => (count > 1 ? 56 : 110);

function strip(place: YearStripPlace, height: number, palette: ReturnType<typeof widgetPalette>, label: string): string {
  const bars = yearStripColumns(place.hoursByDay)
    .map((c) => `<rect x="${c.x}" y="0" width="${c.width}" height="${height}" fill="${c.fill}"/>`)
    .join("");
  const header = place.name
    ? `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:4px">`
      + `<span style="font-size:13px;font-weight:600;color:${palette.onPlate}">${escapeHtml(place.name)}</span>`
      + (place.spanStart && place.spanEnd
        ? `<span style="font-size:11px;color:${palette.onPlateFaint}">${escapeHtml(place.spanStart)} → ${escapeHtml(place.spanEnd)}</span>`
        : "")
      + `</div>`
    : "";
  return `<div style="margin-bottom:10px">${header}`
    + `<svg viewBox="${yearStripViewBox(place.hoursByDay.length, height)}" width="100%" height="${height}" `
    + `role="img" aria-label="${escapeHtml(label)}" preserveAspectRatio="none">${bars}</svg></div>`;
}

export function renderYearStrip({ places, locale, theme }: RenderYearStripOptions): string {
  const copy = widgetStrings(locale);
  const palette = widgetPalette(theme);
  if (!places || places.length === 0) {
    return `<p style="margin:0;color:${palette.textMuted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  const height = stripHeight(places.length);
  const strips = places
    .map((place) => strip(place, height, palette, place.name ? `${place.name}: ${copy.caption}` : copy.caption))
    .join("");
  // One month axis under the stack, not one per strip: the whole point of the
  // comparison is that every strip is the same 365 days on the same axis.
  const months = widgetMonthLabels(locale).map((m) => `<span>${escapeHtml(m)}</span>`).join("");

  return [
    `<figure style="margin:0;color:${palette.textPrimary};font-family:system-ui,sans-serif">`,
    `<div style="padding:12px;border-radius:12px;background:${palette.plate}">`,
    strips,
    `<div style="display:grid;grid-template-columns:repeat(12,1fr);color:${palette.onPlateFaint};font-size:11px">${months}</div>`,
    `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;color:${palette.onPlateFaint};font-size:11px">`,
    `<span>${escapeHtml(copy.legendLow)}</span>`,
    `<span style="height:8px;flex:1;border-radius:99px;background:${HEAT_LEGEND_GRADIENT}"></span>`,
    `<span>${escapeHtml(copy.legendHigh)}</span></div>`,
    `</div>`,
    `<figcaption style="margin-top:8px;color:${palette.textMuted};font-size:12px;line-height:1.4">${escapeHtml(copy.caption)}</figcaption>`,
    `</figure>`,
  ].join("");
}
