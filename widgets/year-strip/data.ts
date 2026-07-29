export const YEAR_STRIP_META_KEY = "getvitamind/year-strip";

export interface YearStripMeta {
  hoursByDay: number[];
}

export function readYearStripMeta(result: unknown): YearStripMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const payload = (meta as Record<string, unknown>)[YEAR_STRIP_META_KEY];
  if (!payload || typeof payload !== "object") return null;
  const hoursByDay = (payload as { hoursByDay?: unknown }).hoursByDay;
  if (!Array.isArray(hoursByDay) || hoursByDay.length === 0 || hoursByDay.length > 366) return null;
  if (!hoursByDay.every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return { hoursByDay };
}
