import { minutesForVitD, erythemaMinutes, type SkinType } from "@/lib/vitd";
import { EXPOSURE_PRESETS, TARGET_PRESETS, type ProfileMeta, type SunProfile } from "./data";
import { profileStrings } from "./i18n";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/** Fitzpatrick swatches, light to dark. */
const SKIN_COLORS = ["#f7d7c4", "#eebfa0", "#d9a679", "#b57c50", "#8a5a34", "#5a3620"];

export interface LiveEstimate {
  minutes: number | null;
  burnMinutes: number | null;
}

/**
 * What the form is for: the numbers that move when you change a control.
 *
 * Computed in the widget from a single UV index rather than asked of the server
 * on every keystroke — the maths is `minutesForVitD`, a closed-form expression,
 * and a round trip per slider drag would make the form feel broken.
 */
export function liveEstimate(profile: SunProfile, uvIndex: number): LiveEstimate {
  const skin = profile.skinType as SkinType;
  const minutes = minutesForVitD(uvIndex, skin, profile.exposedSkinFraction, profile.targetIU, profile.age);
  return {
    minutes: minutes === null ? null : Math.round(minutes),
    burnMinutes: (() => {
      const burn = erythemaMinutes(uvIndex, skin);
      return burn === null ? null : Math.round(burn);
    })(),
  };
}

export interface RenderProfileOptions {
  meta: ProfileMeta | null;
  profile?: SunProfile;
  locale?: unknown;
  theme?: unknown;
}

const palette = (theme: unknown) => ({
  text: theme === "dark" ? "var(--color-text-primary, #f4f5f7)" : "var(--color-text-primary, #17191f)",
  muted: theme === "dark" ? "var(--color-text-secondary, #a8adb8)" : "var(--color-text-secondary, #646b78)",
  border: theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
  selected: "#ffb020",
  card: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
});

export function renderProfile({ meta, profile, locale, theme }: RenderProfileOptions): string {
  const copy = profileStrings(locale);
  const p = palette(theme);
  if (!meta) {
    return `<p style="margin:0;color:${p.muted};font:14px/1.5 system-ui,sans-serif">${escapeHtml(copy.empty)}</p>`;
  }

  const current = profile ?? meta.profile;
  const estimate = liveEstimate(current, meta.uvIndex);

  const skinButtons = SKIN_COLORS.map((color, i) => {
    const type = i + 1;
    const on = current.skinType === type;
    return `<button type="button" data-skin="${type}" aria-pressed="${on}" `
      + `style="width:36px;height:36px;border-radius:10px;background:${color};cursor:pointer;`
      + `border:${on ? `3px solid ${p.selected}` : `1px solid ${p.border}`}">`
      + `<span style="position:absolute;width:1px;height:1px;overflow:hidden">${type}</span></button>`;
  }).join("");

  const exposureButtons = EXPOSURE_PRESETS.map((preset, i) => {
    const on = Math.abs(current.exposedSkinFraction - preset.value) < 0.001;
    return `<button type="button" data-exposure="${preset.value}" aria-pressed="${on}" `
      + `style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 8px;border-radius:10px;`
      + `cursor:pointer;background:${p.card};color:${p.text};font-size:11px;`
      + `border:${on ? `2px solid ${p.selected}` : `1px solid ${p.border}`}">`
      + `<span style="font-size:18px">${preset.emoji}</span>`
      + `<span>${escapeHtml(copy.exposureLabels[i])}</span></button>`;
  }).join("");

  const targetButtons = TARGET_PRESETS.map((iu) => {
    const on = current.targetIU === iu;
    return `<button type="button" data-target="${iu}" aria-pressed="${on}" `
      + `style="padding:5px 10px;border-radius:8px;cursor:pointer;background:${p.card};color:${p.text};font-size:12px;`
      + `border:${on ? `2px solid ${p.selected}` : `1px solid ${p.border}`}">${iu} IU</button>`;
  }).join("");

  const readout = estimate.minutes === null
    ? `<span style="color:${p.muted}">${escapeHtml(copy.noSun)}</span>`
    : `<strong style="font-size:26px;color:${p.selected}">${estimate.minutes}</strong> `
      + `<span style="color:${p.muted}">${escapeHtml(copy.minutes)}</span>`
      + (estimate.burnMinutes !== null
        ? ` · <strong>${estimate.burnMinutes}</strong> <span style="color:${p.muted}">${escapeHtml(copy.burn)}</span>`
        : "");

  const where = meta.placeName
    ? ` <span style="color:${p.muted};font-size:12px">${escapeHtml(copy.at)} ${escapeHtml(meta.placeName)} · UV ${meta.uvIndex}</span>`
    : ` <span style="color:${p.muted};font-size:12px">UV ${meta.uvIndex}</span>`;

  return [
    `<form id="profile-form" style="margin:0;font-family:system-ui,sans-serif;color:${p.text};display:grid;gap:12px">`,
    `<div style="font-size:16px;font-weight:650">${escapeHtml(copy.title)}${where}</div>`,
    `<div><div style="font-size:12px;color:${p.muted};margin-bottom:4px">${escapeHtml(copy.skin)} — ${escapeHtml(copy.skinHint)}</div>`,
    `<div style="display:flex;gap:6px;position:relative">${skinButtons}</div></div>`,
    `<div><div style="font-size:12px;color:${p.muted};margin-bottom:4px">${escapeHtml(copy.exposure)}</div>`,
    `<div style="display:flex;gap:6px;flex-wrap:wrap">${exposureButtons}</div></div>`,
    `<div style="display:flex;gap:16px;align-items:end;flex-wrap:wrap">`,
    `<label style="font-size:12px;color:${p.muted}">${escapeHtml(copy.age)}<br>`,
    `<input id="profile-age" type="number" min="0" max="120" value="${current.age ?? ""}" `,
    `placeholder="${escapeHtml(copy.ageAny)}" style="width:84px;padding:5px 8px;border-radius:8px;`,
    `border:1px solid ${p.border};background:transparent;color:${p.text};font-size:13px"></label>`,
    `<div><div style="font-size:12px;color:${p.muted};margin-bottom:4px">${escapeHtml(copy.target)}</div>`,
    `<div style="display:flex;gap:6px;flex-wrap:wrap">${targetButtons}</div></div>`,
    `</div>`,
    `<div style="padding:10px 12px;border-radius:10px;background:${p.card};font-size:13px">${readout}</div>`,
    `</form>`,
  ].join("");
}
