/**
 * Per-locale grammar for the city pages.
 *
 * ICU cannot elide, contract or change case, so every value handed to a
 * `cityPage` message must already be in the form its template needs. Each helper
 * here owns one such transformation. All are pure and run at build time.
 */

/** A fixed reference year keeps month formatting deterministic across builds. */
const REF_YEAR = 2026;
const REF_DAY = 15;

const refDate = (monthIndex: number) => new Date(REF_YEAR, monthIndex, REF_DAY);

export function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nominative long month name, e.g. "enero" / "January" / "январь" / "sausis". */
export function monthName(locale: string, monthIndex: number): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(refDate(monthIndex));
}

/** Locales whose month names must be declined in "from X to Y" constructions. */
const GENITIVE_LOCALES = new Set(["ru", "lt"]);

/**
 * Genitive month name for ru/lt, obtained by formatting with a day — which puts
 * the month into its genitive form ("15 января", "sausio 15 d.") — and stripping
 * the day back out. Other locales have no genitive, so the nominative is returned.
 */
export function monthGenitive(locale: string, monthIndex: number): string {
  if (!GENITIVE_LOCALES.has(locale)) return monthName(locale, monthIndex);
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" })
    .format(refDate(monthIndex))
    .replace(/[0-9]/g, "")
    .replace(/\s*d\.\s*$/, "") // lt appends a "d." day marker
    .replace(/[.,]/g, "")
    .trim();
}

/**
 * French: put the city into "à <city>", contracting the definite article.
 * Only the FRENCH article contracts — "Las Palmas" and "Los Angeles" carry a
 * Spanish article and stay literal ("à Las Palmas").
 */
export function frAtCity(name: string): string {
  if (name.startsWith("Le ")) return `au ${name.slice(3)}`;
  if (name.startsWith("Les ")) return `aux ${name.slice(4)}`;
  if (name.startsWith("La ")) return `à la ${name.slice(3)}`;
  if (name.startsWith("L'")) return `à l'${name.slice(2)}`;
  return `à ${name}`;
}

/** French elision: "de mars" but "d'avril" / "d'août" / "d'octobre". */
export function frFromMonth(month: string): string {
  return /^[aeiouâàéèêîôûh]/i.test(month) ? `d'${month}` : `de ${month}`;
}

/**
 * Lithuanian has no alphabetic month abbreviations in CLDR — both `narrow` and
 * `short` return "01".."12" — so the chart would show numbers where every other
 * locale shows letters. These are the standard lt abbreviations.
 */
const LT_MONTH_LABELS = [
  "saus.", "vas.", "kov.", "bal.", "geg.", "birž.",
  "liep.", "rugp.", "rugs.", "spal.", "lapkr.", "gruod.",
];

/** Twelve short month labels for the year-profile chart. */
export function monthLabels(locale: string): string[] {
  if (locale === "lt") return [...LT_MONTH_LABELS];
  const fmt = new Intl.DateTimeFormat(locale, { month: "narrow" });
  return Array.from({ length: 12 }, (_, m) => fmt.format(refDate(m)));
}

export interface CityLabels {
  city: string;
  /** French "à <city>" with the article contracted; the plain name elsewhere. */
  atCity: string;
  /** Sentence-initial form of `atCity`. */
  atCityCap: string;
}

export function cityLabels(locale: string, name: string): CityLabels {
  if (locale !== "fr") return { city: name, atCity: name, atCityCap: name };
  const atCity = frAtCity(name);
  return { city: name, atCity, atCityCap: capFirst(atCity) };
}

export interface VerdictMonths {
  /** The month after "from"/"de"/"с"/"nuo", already declined where required. */
  startMonth: string;
  /** The month after "to"/"a"/"по"/"iki", already declined where required. */
  endMonth: string;
  /** French only: "d'avril" / "de mars" — the preposition is part of the value. */
  fromMonth: string;
  /** Sentence-initial form of `fromMonth`. */
  fromMonthCap: string;
}

/**
 * The month values for the verdict sentences.
 *
 * - ru: `с` governs the genitive, but `по` governs the accusative — and months
 *   are masculine inanimate, so accusative == nominative. Only the start declines.
 * - lt: `nuo … iki …` governs the genitive on both.
 * - fr: `de` elides to `d'` before a vowel, so the preposition ships with the value.
 */
export function verdictMonths(locale: string, startIndex: number, endIndex: number): VerdictMonths {
  const startMonth =
    locale === "ru" || locale === "lt" ? monthGenitive(locale, startIndex) : monthName(locale, startIndex);
  const endMonth = locale === "lt" ? monthGenitive(locale, endIndex) : monthName(locale, endIndex);
  const fromMonth = frFromMonth(monthName(locale, startIndex));
  return { startMonth, endMonth, fromMonth, fromMonthCap: capFirst(fromMonth) };
}
