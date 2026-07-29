export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];
interface WidgetCopy { caption: string; legendLow: string; legendHigh: string; empty: string }

const COPY: Record<WidgetLocale, WidgetCopy> = {
  en: { caption: "Daily hours with enough sun to synthesize vitamin D across the year.", legendLow: "0 h", legendHigh: "10 h+", empty: "No year profile data was returned." },
  es: { caption: "Horas diarias con sol suficiente para sintetizar vitamina D a lo largo del año.", legendLow: "0 h", legendHigh: "10 h+", empty: "No se recibieron datos del perfil anual." },
  fr: { caption: "Nombre d'heures par jour où le soleil est assez haut pour synthétiser la vitamine D, au fil de l'année.", legendLow: "0 h", legendHigh: "10 h+", empty: "Aucune donnée de profil annuel n'a été reçue." },
  de: { caption: "Tägliche Stunden mit ausreichender Sonne zur Vitamin-D-Bildung im Jahresverlauf.", legendLow: "0 h", legendHigh: "10 h+", empty: "Es wurden keine Jahresprofildaten empfangen." },
  ru: { caption: "Сколько часов в день солнце стоит достаточно высоко для синтеза витамина D — по месяцам года.", legendLow: "0 ч", legendHigh: "10 ч+", empty: "Данные годового профиля не получены." },
  lt: { caption: "Valandos per dieną, kai saulės pakanka vitaminui D gaminti — ištisus metus.", legendLow: "0 h", legendHigh: "10 h+", empty: "Metinio profilio duomenys negauti." },
};

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
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? base as WidgetLocale : "en";
}
export function widgetStrings(locale: unknown): WidgetCopy { return COPY[resolveWidgetLocale(locale)]; }
export function widgetMonthLabels(locale: unknown): string[] { return MONTHS[resolveWidgetLocale(locale)]; }
