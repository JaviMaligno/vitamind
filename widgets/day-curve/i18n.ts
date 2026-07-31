export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];

/**
 * The only copy this widget owns. Every verdict, label and hint comes from
 * `generated-copy.ts`, lifted from the app's own messages at build time, so the
 * chat and the app never describe the same moment with different words (#29).
 */
const EMPTY: Record<WidgetLocale, string> = {
  en: "No reading was returned for this place.",
  es: "No se recibió ninguna medición para este lugar.",
  fr: "Aucune mesure reçue pour ce lieu.",
  de: "Für diesen Ort kam kein Messwert an.",
  ru: "Для этого места данные не получены.",
  lt: "Šiai vietai duomenų negauta.",
};

export function resolveWidgetLocale(locale: unknown): WidgetLocale {
  if (typeof locale !== "string") return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? (base as WidgetLocale) : "en";
}

export function emptyText(locale: unknown): string {
  return EMPTY[resolveWidgetLocale(locale)];
}
