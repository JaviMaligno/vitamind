import { curvePath, viableBand } from "@/lib/day-curve";
import { dayCurveStrings } from "./i18n";
import { dayCurvePalette } from "./theme";
import type { DayCurveMeta } from "./data";

const W = 640;
const H = 200;
const PAD = { t: 16, r: 14, b: 22, l: 14 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/** Decimal local hours as HH:MM. */
export function fmtHours(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  const carry = minutes === 60;
  return `${String((carry ? hours + 1 : hours) % 24).padStart(2, "0")}:${String(carry ? 0 : minutes).padStart(2, "0")}`;
}

export interface RenderDayCurveOptions {
  meta: DayCurveMeta | null;
  locale?: unknown;
  theme?: unknown;
}

export function renderDayCurve({ meta, locale, theme }: RenderDayCurveOptions): string {
  const copy = dayCurveStrings(locale);
  if (!meta) {
    const palette = dayCurvePalette(theme, "no_synthesis");
    return `<p style="margin:0;color:${palette.textMuted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  const palette = dayCurvePalette(theme, meta.state);
  const peak = Math.max(...meta.elevations, meta.thresholdElevation + 5);
  // The horizon anchors the bottom: elevations below it are night, and letting
  // the scale follow them would squash the useful part of the chart.
  const box = { width: PLOT_W, height: PLOT_H, min: Math.min(0, meta.thresholdElevation - 5), max: peak };
  const path = curvePath(meta.elevations, box);
  const band = viableBand(meta.elevations, meta.thresholdElevation);

  const xForHour = (h: number) => PAD.l + (h / 24) * PLOT_W;
  const yForElevation = (e: number) =>
    PAD.t + PLOT_H - ((e - box.min) / (box.max - box.min || 1)) * PLOT_H;

  const bandRect = band
    ? `<rect x="${xForHour(band.startHours).toFixed(1)}" y="${PAD.t}" `
      + `width="${(xForHour(band.endHours) - xForHour(band.startHours)).toFixed(1)}" height="${PLOT_H}" `
      + `fill="${palette.accent}" opacity="0.16"/>`
    : "";

  const thresholdY = yForElevation(meta.thresholdElevation).toFixed(1);
  const thresholdLine = `<line x1="${PAD.l}" y1="${thresholdY}" x2="${W - PAD.r}" y2="${thresholdY}" `
    + `stroke="${palette.accent}" stroke-width="1" stroke-dasharray="4 4" opacity="0.7"/>`;

  const nowMarker = meta.nowLocalHours !== null
    ? `<line x1="${xForHour(meta.nowLocalHours).toFixed(1)}" y1="${PAD.t}" `
      + `x2="${xForHour(meta.nowLocalHours).toFixed(1)}" y2="${PAD.t + PLOT_H}" `
      + `stroke="${palette.onPlate}" stroke-width="1.5" opacity="0.85"/>`
    : "";

  const hourLabels = [0, 6, 12, 18, 24]
    .map((h) => `<text x="${xForHour(h).toFixed(1)}" y="${H - 6}" fill="${palette.onPlateFaint}" `
      + `font-size="10" text-anchor="${h === 0 ? "start" : h === 24 ? "end" : "middle"}">${String(h).padStart(2, "0")}</text>`)
    .join("");

  const facts = [
    `${escapeHtml(copy.uv)} <strong>${meta.uvIndex}</strong>`,
    meta.minutesNeeded !== null ? `<strong>${meta.minutesNeeded}</strong> ${escapeHtml(copy.minutes)}` : null,
    meta.windowStart !== null && meta.windowEnd !== null
      ? `${escapeHtml(copy.window)} <strong>${fmtHours(meta.windowStart)}–${fmtHours(meta.windowEnd)}</strong>`
      : null,
    meta.cloudCoverPercent !== null ? `<strong>${meta.cloudCoverPercent}%</strong> ${escapeHtml(copy.clouds)}` : null,
  ].filter(Boolean).join(" · ");

  return [
    `<figure style="margin:0;font-family:system-ui,sans-serif;color:${palette.textPrimary}">`,
    `<div style="font-size:22px;line-height:1.25;font-weight:650;margin-bottom:10px;color:${palette.accent}">`,
    escapeHtml(copy.headline[meta.state]),
    `</div>`,
    `<div style="border-radius:12px;background:${palette.plate};padding:4px">`,
    `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escapeHtml(copy.headline[meta.state])}">`,
    bandRect,
    thresholdLine,
    `<g transform="translate(${PAD.l},${PAD.t})">`,
    `<path d="${path}" fill="none" stroke="${palette.accent}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `</g>`,
    nowMarker,
    hourLabels,
    `</svg>`,
    `</div>`,
    `<figcaption style="margin-top:8px;font-size:13px;line-height:1.5;color:${palette.textMuted}">`,
    facts,
    `</figcaption>`,
    `</figure>`,
  ].join("");
}
