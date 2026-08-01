import { DAY_COPY } from "./generated-copy";
import { statusKey, formatCountdown, fmtMin, type DayMeta, type SolarPhase, type StatusKey } from "./data";
import { resolveWidgetLocale } from "./i18n";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/**
 * Dot colour per verdict, copied from `DOT` in components/dashboard/DayHeroBold.tsx
 * so the chat and the app agree on what green means.
 */
const DOT: Record<StatusKey, string> = {
  optimal: "#5fd39b",
  moderate: "#fbbf24",
  upcoming: "#60a5fa",
  windowClosed: "#cbd5e1",
  insufficient: "#f87171",
};

/**
 * The four skies, copied literally from `--grad-*` in app/globals.css. The
 * iframe inherits no CSS variables, so the values travel rather than the names.
 */
const SKY: Record<SolarPhase, string> = {
  dawn: "linear-gradient(165deg, #ffb07a 0%, #ff7a9c 55%, #c9457e 100%)",
  day: "linear-gradient(165deg, #6fb7ef 0%, #a6d4f4 42%, #ffd7a8 100%)",
  dusk: "linear-gradient(165deg, #ff7a45 0%, #e0457e 55%, #7a3a9e 100%)",
  night: "radial-gradient(120% 90% at 75% -10%, #3a2f6b 0%, #141a3a 50%, #0a0e24 100%)",
};

/**
 * The sky for the hour, under the same dark scrim the app's hero uses. The veil
 * is what lets one set of hardcoded status colours and white text work over all
 * four gradients — without it, white on the pale midday sky is unreadable.
 *
 * No phase means night, which is what the flat plate used to be.
 */
function plateFor(phase: SolarPhase | null | undefined): string {
  return `linear-gradient(rgba(10,15,40,0.74), rgba(10,15,40,0.88)), ${SKY[phase ?? "night"]}`;
}

const palette = (theme: unknown) => ({
  text: theme === "dark" ? "var(--color-text-primary, #f4f5f7)" : "var(--color-text-primary, #17191f)",
  muted: theme === "dark" ? "var(--color-text-secondary, #a8adb8)" : "var(--color-text-secondary, #646b78)",
  onPlate: "rgba(255,255,255,0.92)",
  onPlateFaint: "rgba(255,255,255,0.55)",
});

/** Fills `{countdown}` / `{hour}` the way next-intl would, without shipping it. */
function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`);
}

export interface Verdict {
  headline: string;
  hint: string | null;
}

/**
 * The headline and hint, mirroring the branch order of DayHeroBold. This is the
 * whole point of the widget: the first thing on screen is the answer in words,
 * not a chart that has to be decoded first (#29).
 */
export function verdict(meta: DayMeta, locale: unknown): Verdict {
  const copy = DAY_COPY[resolveWidgetLocale(locale)];
  const key = statusKey(meta);

  if (key === "optimal") return { headline: copy.nowOptimalTitle, hint: copy.nowOptimalHint };
  if (key === "moderate") return { headline: copy.nowModerateTitle, hint: copy.nowModerateHint };
  if (key === "upcoming") {
    return {
      headline: interpolate(copy.nowUpcomingTitle, {
        countdown: formatCountdown(meta.minutesUntilWindow ?? 0),
        hour: `${meta.windowStart ?? 0}:00`,
      }),
      hint: meta.cloudDegraded ? copy.cloudDegraded : null,
    };
  }
  if (key === "windowClosed") {
    return {
      headline: interpolate(copy.nowClosedTitle, { hour: `${meta.windowEnd ?? 0}:00` }),
      hint: copy.nowClosedHint,
    };
  }
  return {
    headline: copy.noWindowToday,
    hint: meta.cloudDegraded ? copy.cloudDegradedFull : copy.noWindowHint,
  };
}

export interface Stat {
  label: string;
  value: string;
}

/**
 * The numbers under the verdict, same selection and order as the app's hero.
 *
 * Only shown when there is a window to talk about — on a day with no synthesis,
 * a UV reading and an empty window are noise around a verdict that already said
 * everything.
 */
export function stats(meta: DayMeta, locale: unknown): Stat[] {
  const copy = DAY_COPY[resolveWidgetLocale(locale)];
  if (meta.state !== "good_now" && meta.state !== "upcoming") return [];

  const out: Stat[] = [{ label: copy.currentUVI, value: meta.uvIndex.toFixed(1) }];

  if (meta.windowStart !== null && meta.windowEnd !== null) {
    out.push({ label: copy.nowWindow, value: `${meta.windowStart}:00 – ${meta.windowEnd}:00` });
  }
  if (meta.state === "good_now" && meta.minutesNeeded !== null) {
    out.push({ label: copy.nowTimeNeeded, value: fmtMin(meta.minutesNeeded) });
  }
  if (meta.state === "good_now" && meta.windowClosesInMinutes !== null) {
    out.push({ label: copy.nowClosesIn, value: formatCountdown(meta.windowClosesInMinutes) });
  }
  if (meta.state === "upcoming" && meta.bestHour !== null && meta.bestMinutes !== null) {
    out.push({ label: copy.nowBestHour, value: `${fmtMin(meta.bestMinutes)} · ${meta.bestHour}:00` });
  }
  return out;
}

export interface RenderDayOptions {
  meta: DayMeta | null;
  locale?: unknown;
  theme?: unknown;
  emptyText?: string;
}

export function renderDay({ meta, locale, theme, emptyText }: RenderDayOptions): string {
  const p = palette(theme);
  if (!meta) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">`
      + `${escapeHtml(emptyText ?? "No reading was returned for this place.")}</p>`;
  }

  const key = statusKey(meta);
  const v = verdict(meta, locale);
  const cells = stats(meta, locale);

  const statBlocks = cells.map((s) =>
    `<div style="min-width:96px">`
    + `<span style="display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${p.onPlateFaint}">${escapeHtml(s.label)}</span>`
    + `<span style="font-size:20px;font-weight:600;color:${p.onPlate}">${escapeHtml(s.value)}</span>`
    + `</div>`).join("");

  return [
    `<figure style="margin:0;font-family:system-ui,sans-serif">`,
    `<div style="border-radius:16px;background:${plateFor(meta.phase)};padding:18px 20px">`,
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">`,
    `<span style="width:10px;height:10px;border-radius:50%;background:${DOT[key]};flex:none"></span>`,
    `<span style="font-size:22px;line-height:1.25;font-weight:650;color:${p.onPlate}">${escapeHtml(v.headline)}</span>`,
    `</div>`,
    v.hint ? `<div style="font-size:13px;line-height:1.5;color:${p.onPlateFaint};margin-bottom:14px">${escapeHtml(v.hint)}</div>` : "",
    cells.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:18px 24px">${statBlocks}</div>`
      : "",
    `</div>`,
    `</figure>`,
  ].join("");
}
