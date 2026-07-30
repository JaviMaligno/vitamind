/**
 * Abbreviated month names per locale, shared by every widget that has to label a
 * calendar. Kept here rather than in each widget's i18n so the year strip and the
 * history calendar can never drift into naming the same month differently.
 *
 * Dependency-free: these ship inside the iframe bundles.
 */
export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];

const MONTHS: Record<WidgetLocale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  de: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."],
  ru: ["янв.", "февр.", "март", "апр.", "май", "июнь", "июль", "авг.", "сент.", "окт.", "нояб.", "дек."],
  lt: ["saus.", "vas.", "kov.", "bal.", "geg.", "birž.", "liep.", "rugp.", "rugs.", "spal.", "lapkr.", "gruod."],
};

export function resolveWidgetLocale(locale: unknown): WidgetLocale {
  if (typeof locale !== "string") return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? (base as WidgetLocale) : "en";
}

/** The twelve abbreviations, January first. */
export function monthLabels(locale: unknown): string[] {
  return MONTHS[resolveWidgetLocale(locale)];
}

/** The abbreviation for a 0-based month index. */
export function monthLabel(locale: unknown, monthIndex: number): string {
  return monthLabels(locale)[((monthIndex % 12) + 12) % 12];
}
