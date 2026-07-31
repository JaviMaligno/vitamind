export const YEAR_STRIP_META_KEY = "getvitamind/year-strip";

export interface YearStripPlace {
  /** Absent on the single-place payload, where the chat already names the city. */
  name?: string;
  hoursByDay: number[];
  /** "MM-DD" season bounds, when the place has a season rather than none or all year. */
  spanStart?: string;
  spanEnd?: string;
}

export interface YearStripMeta {
  places: YearStripPlace[];
  /** Only on the single-place payload; the comparison captions each strip. */
  verdict: YearVerdict | null;
}

/** What the headline needs to state the answer before the picture is read. */
export interface YearVerdict {
  name?: string;
  allYear: boolean;
  neverPossible: boolean;
  monthsWithSun: number;
  spanStart?: string;
  spanEnd?: string;
}

const isHours = (value: unknown): value is number[] =>
  Array.isArray(value)
  && value.length > 0
  && value.length <= 366
  && value.every((v) => typeof v === "number" && Number.isFinite(v));

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= 80 ? value : undefined;

function readPlace(raw: unknown): YearStripPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (!isHours(p.hoursByDay)) return null;
  return {
    name: str(p.name),
    hoursByDay: p.hoursByDay,
    spanStart: str(p.spanStart),
    spanEnd: str(p.spanEnd),
  };
}

/**
 * Reads the chart channel, normalising both shapes into a list of places.
 *
 * One tool sends a single year (`hoursByDay`), the comparison tool sends several
 * (`places`). They share this widget — and therefore one bundle and one visual
 * language — because a comparison is the same picture repeated on a shared axis,
 * not a different chart. The single-place shape is the original one and still
 * reads on its own, so a payload from before the comparison existed keeps working.
 */
export function readYearStripMeta(result: unknown): YearStripMeta | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return null;
  const payload = (meta as Record<string, unknown>)[YEAR_STRIP_META_KEY];
  if (!payload || typeof payload !== "object") return null;

  const p = payload as Record<string, unknown>;

  if (Array.isArray(p.places)) {
    // Five is what the tool accepts; more would be unreadable stacked anyway.
    const places = p.places.slice(0, 5).map(readPlace).filter((x): x is YearStripPlace => x !== null);
    // A comparison needs no headline: every strip is already captioned with its
    // own name and season, and one verdict cannot speak for five places.
    return places.length > 0 ? { places, verdict: null } : null;
  }

  const single = readPlace(p);
  if (!single) return null;
  return {
    places: [single],
    verdict: {
      name: str(p.name),
      allYear: p.allYear === true,
      neverPossible: p.neverPossible === true,
      monthsWithSun: typeof p.monthsWithSun === "number" ? p.monthsWithSun : 0,
      spanStart: str(p.spanStart),
      spanEnd: str(p.spanEnd),
    },
  };
}
