export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];

interface Copy {
  title: string;
  streak: string;
  tracked: string;
  confirmed: string;
  declined: string;
  viable: string;
  missed: string;
  /** No record for that day — not a verdict about it. */
  unlogged: string;
  /** Heading for the stretches of where you were. */
  whereLabel: string;
  /** `{assumed}` of `{total}` days inherited their place. */
  assumedNote: string;
  tapHint: string;
  signedOut: string;
  signedOutHint: string;
  empty: string;
  weekdays: [string, string, string, string, string, string, string];
}

const COPY: Record<WidgetLocale, Copy> = {
  en: {
    title: "Your sun history", streak: "day streak", tracked: "days tracked",
    confirmed: "went outside", declined: "stayed in", viable: "sun was viable", missed: "no viable sun", unlogged: "no data",
    whereLabel: "Where you were", assumedNote: "{assumed} of {total} days were not recorded; they take the nearest stretch. Tap to correct.",
    tapHint: "Tap a day: went out → stayed in → no answer",
    signedOut: "Connect your account to see your history",
    signedOutHint: "Reconnect this server with the account connector and the calendar fills in.",
    empty: "No days tracked yet.",
    weekdays: ["M", "T", "W", "T", "F", "S", "S"],
  },
  es: {
    title: "Tu historial de sol", streak: "días seguidos", tracked: "días registrados",
    confirmed: "saliste", declined: "no saliste", viable: "hubo sol útil", missed: "sin sol útil", unlogged: "sin datos",
    whereLabel: "Dónde estabas", assumedNote: "{assumed} de {total} días no se registraron; se han asignado al tramo más cercano. Toca para corregir.",
    tapHint: "Toca un día: saliste → no saliste → sin respuesta",
    signedOut: "Conecta tu cuenta para ver tu historial",
    signedOutHint: "Reconecta este servidor con el conector de cuenta y el calendario se rellena.",
    empty: "Aún no hay días registrados.",
    weekdays: ["L", "M", "X", "J", "V", "S", "D"],
  },
  fr: {
    title: "Votre historique solaire", streak: "jours d'affilée", tracked: "jours suivis",
    confirmed: "sorti", declined: "resté dedans", viable: "soleil suffisant", missed: "soleil insuffisant", unlogged: "pas de données",
    whereLabel: "Où vous étiez", assumedNote: "{assumed} des {total} jours n'ont pas été enregistrés ; ils reprennent la période la plus proche. Touchez pour corriger.",
    tapHint: "Touchez un jour : sorti → resté dedans → sans réponse",
    signedOut: "Connectez votre compte pour voir votre historique",
    signedOutHint: "Reconnectez ce serveur avec le connecteur de compte et le calendrier se remplit.",
    empty: "Aucun jour suivi pour l'instant.",
    weekdays: ["L", "M", "M", "J", "V", "S", "D"],
  },
  de: {
    title: "Deine Sonnen-Historie", streak: "Tage in Folge", tracked: "Tage erfasst",
    confirmed: "warst draußen", declined: "drinnen geblieben", viable: "Sonne reichte", missed: "Sonne reichte nicht", unlogged: "keine Daten",
    whereLabel: "Wo du warst", assumedNote: "{assumed} von {total} Tagen wurden nicht erfasst; sie übernehmen den nächstgelegenen Abschnitt. Zum Korrigieren tippen.",
    tapHint: "Tippe einen Tag: draußen → drinnen → keine Angabe",
    signedOut: "Verbinde dein Konto, um die Historie zu sehen",
    signedOutHint: "Verbinde diesen Server über den Konto-Connector, dann füllt sich der Kalender.",
    empty: "Noch keine Tage erfasst.",
    weekdays: ["M", "D", "M", "D", "F", "S", "S"],
  },
  ru: {
    title: "Ваша история солнца", streak: "дней подряд", tracked: "дней отмечено",
    confirmed: "выходили", declined: "остались дома", viable: "солнца хватало", missed: "солнца не хватало", unlogged: "нет данных",
    whereLabel: "Где вы были", assumedNote: "{assumed} из {total} дней не записаны; взят ближайший отрезок. Нажмите, чтобы исправить.",
    tapHint: "Нажмите на день: вышли → остались → без ответа",
    signedOut: "Подключите аккаунт, чтобы увидеть историю",
    signedOutHint: "Переподключите сервер через коннектор с аккаунтом — календарь заполнится.",
    empty: "Пока нет отмеченных дней.",
    weekdays: ["П", "В", "С", "Ч", "П", "С", "В"],
  },
  lt: {
    title: "Jūsų saulės istorija", streak: "dienų iš eilės", tracked: "dienų sekama",
    confirmed: "buvote lauke", declined: "likote viduje", viable: "saulės pakako", missed: "saulės nepakako", unlogged: "nėra duomenų",
    whereLabel: "Kur buvote", assumedNote: "{assumed} iš {total} dienų neužfiksuota; priskirta artimiausiam ruožui. Palieskite, kad pataisytumėte.",
    tapHint: "Bakstelėkite dieną: lauke → viduje → be atsakymo",
    signedOut: "Prijunkite paskyrą, kad matytumėte istoriją",
    signedOutHint: "Prijunkite šį serverį per paskyros jungtį ir kalendorius užsipildys.",
    empty: "Kol kas dienų nėra.",
    weekdays: ["P", "A", "T", "K", "P", "Š", "S"],
  },
};

export function resolveWidgetLocale(locale: unknown): WidgetLocale {
  if (typeof locale !== "string") return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? (base as WidgetLocale) : "en";
}

export function historyStrings(locale: unknown): Copy {
  return COPY[resolveWidgetLocale(locale)];
}
