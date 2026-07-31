export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];

interface Copy {
  title: string;
  /** The headline when there is a day worth picking. */
  bestIs: string;
  bestIsToday: string;
  /** Cuando todos los días valen: elegir uno no es la respuesta útil. */
  anyDay: string;
  noSun: string;
  today: string;
  tomorrow: string;
  noWindow: string;
  empty: string;
  weekdays: [string, string, string, string, string, string, string];
}

const COPY: Record<WidgetLocale, Copy> = {
  en: {
    title: "The next few days", bestIs: "Best day: {day}", bestIsToday: "Today is the best day", anyDay: "Any day works — go today",
    noSun: "No usable sun in the next few days", today: "today", tomorrow: "tomorrow",
    noWindow: "no window", empty: "No forecast was returned.",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  es: {
    title: "Los próximos días", bestIs: "Mejor día: {day}", bestIsToday: "Hoy es el mejor día", anyDay: "Cualquier día vale, sal hoy",
    noSun: "No hay sol aprovechable estos días", today: "hoy", tomorrow: "mañana",
    noWindow: "sin ventana", empty: "No se recibió previsión.",
    weekdays: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
  },
  fr: {
    title: "Les prochains jours", bestIs: "Meilleur jour : {day}", bestIsToday: "Aujourd'hui est le meilleur jour", anyDay: "N'importe quel jour convient — sortez aujourd'hui",
    noSun: "Pas de soleil exploitable ces jours-ci", today: "aujourd'hui", tomorrow: "demain",
    noWindow: "pas de fenêtre", empty: "Aucune prévision reçue.",
    weekdays: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
  },
  de: {
    title: "Die nächsten Tage", bestIs: "Bester Tag: {day}", bestIsToday: "Heute ist der beste Tag", anyDay: "Jeder Tag geht — geh heute raus",
    noSun: "In den nächsten Tagen keine nutzbare Sonne", today: "heute", tomorrow: "morgen",
    noWindow: "kein Fenster", empty: "Keine Vorhersage empfangen.",
    weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  },
  ru: {
    title: "Ближайшие дни", bestIs: "Лучший день: {day}", bestIsToday: "Сегодня — лучший день", anyDay: "Подойдёт любой день — выходите сегодня",
    noSun: "В ближайшие дни солнца не хватит", today: "сегодня", tomorrow: "завтра",
    noWindow: "нет окна", empty: "Прогноз не получен.",
    weekdays: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"],
  },
  lt: {
    title: "Artimiausios dienos", bestIs: "Geriausia diena: {day}", bestIsToday: "Šiandien geriausia diena", anyDay: "Tinka bet kuri diena — eikite šiandien",
    noSun: "Artimiausiomis dienomis saulės nepakaks", today: "šiandien", tomorrow: "rytoj",
    noWindow: "nėra lango", empty: "Prognozė negauta.",
    weekdays: ["pir", "ant", "tre", "ket", "pen", "šeš", "sek"],
  },
};

export function resolveWidgetLocale(locale: unknown): WidgetLocale {
  if (typeof locale !== "string") return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? (base as WidgetLocale) : "en";
}

export function forecastStrings(locale: unknown): Copy {
  return COPY[resolveWidgetLocale(locale)];
}
