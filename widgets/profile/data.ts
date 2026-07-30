export const PROFILE_META_KEY = "getvitamind/profile";

export interface SunProfile {
  skinType: 1 | 2 | 3 | 4 | 5 | 6;
  exposedSkinFraction: number;
  age: number | null;
  targetIU: number;
}

export interface ProfileMeta {
  profile: SunProfile;
  /**
   * UV index the live estimate is computed against — the best hour today at the
   * place under discussion, or a reference value when no place is known. Sending
   * one number instead of a curve is what lets the form recompute instantly
   * without a round trip through the host.
   */
  uvIndex: number;
  placeName?: string;
  /**
   * True when the connection can write to the account. False on the public
   * connector, where the picker is context-only — the widget says which it is
   * rather than offering a Save that would come back insufficient_scope.
   */
  canSave: boolean;
}

/** The presets the app itself offers, so the widget and the app agree. */
export const EXPOSURE_PRESETS = [
  { emoji: "🧤", value: 0.1 },
  { emoji: "💪", value: 0.18 },
  { emoji: "👕", value: 0.25 },
  { emoji: "🩱", value: 0.4 },
] as const;

export const TARGET_PRESETS = [400, 1000, 2000, 4000] as const;

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export function normalizeProfile(raw: unknown): SunProfile {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const skin = typeof p.skinType === "number" ? clamp(Math.round(p.skinType), 1, 6) : 3;
  const area = typeof p.exposedSkinFraction === "number" ? clamp(p.exposedSkinFraction, 0.05, 1) : 0.25;
  const age = typeof p.age === "number" ? clamp(Math.round(p.age), 0, 120) : null;
  const target = typeof p.targetIU === "number" ? clamp(Math.round(p.targetIU), 100, 10000) : 1000;
  return { skinType: skin as SunProfile["skinType"], exposedSkinFraction: area, age, targetIU: target };
}

export function readProfileMeta(result: unknown): ProfileMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>)[PROFILE_META_KEY];
  if (!raw || typeof raw !== "object") return null;

  const p = raw as Record<string, unknown>;
  const uv = typeof p.uvIndex === "number" && Number.isFinite(p.uvIndex) ? p.uvIndex : null;
  if (uv === null) return null;

  return {
    profile: normalizeProfile(p.profile),
    uvIndex: uv,
    placeName: typeof p.placeName === "string" && p.placeName.length <= 60 ? p.placeName : undefined,
    canSave: p.canSave === true,
  };
}
