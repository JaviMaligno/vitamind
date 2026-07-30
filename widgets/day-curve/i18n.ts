import type { DayState } from "./data";

export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];

interface Copy {
  /** Poster verdict, one per state. */
  headline: Record<DayState, string>;
  uv: string;
  minutes: string;
  window: string;
  clouds: string;
  threshold: string;
  empty: string;
}

/**
 * Bundled per locale rather than pushed through the tool payload: the server has
 * no idea what language the conversation is in, but the host tells the iframe via
 * ctx.locale. Six languages of four short strings is smaller than one round trip.
 */
const COPY: Record<WidgetLocale, Copy> = {
  en: {
    headline: {
      good_now: "Good sun right now",
      upcoming: "Not yet — the window opens later",
      window_closed: "Today's window has closed",
      no_synthesis: "No vitamin D from the sun today",
    },
    uv: "UV index", minutes: "minutes needed", window: "Window", clouds: "cloud cover",
    threshold: "synthesis threshold", empty: "No reading was returned for this place.",
  },
  es: {
    headline: {
      good_now: "Ahora mismo hay buen sol",
      upcoming: "Todavía no: la ventana abre más tarde",
      window_closed: "La ventana de hoy ya se ha cerrado",
      no_synthesis: "Hoy el sol no da para vitamina D",
    },
    uv: "índice UV", minutes: "minutos necesarios", window: "Ventana", clouds: "nubosidad",
    threshold: "umbral de síntesis", empty: "No se recibió ninguna medición para este lugar.",
  },
  fr: {
    headline: {
      good_now: "Bon soleil en ce moment",
      upcoming: "Pas encore : la fenêtre ouvre plus tard",
      window_closed: "La fenêtre du jour est fermée",
      no_synthesis: "Pas de vitamine D au soleil aujourd'hui",
    },
    uv: "indice UV", minutes: "minutes nécessaires", window: "Fenêtre", clouds: "nébulosité",
    threshold: "seuil de synthèse", empty: "Aucune mesure reçue pour ce lieu.",
  },
  de: {
    headline: {
      good_now: "Gerade jetzt gute Sonne",
      upcoming: "Noch nicht — das Fenster öffnet später",
      window_closed: "Das heutige Fenster ist zu",
      no_synthesis: "Heute kein Vitamin D durch die Sonne",
    },
    uv: "UV-Index", minutes: "benötigte Minuten", window: "Fenster", clouds: "Bewölkung",
    threshold: "Synthese-Schwelle", empty: "Für diesen Ort kam kein Messwert an.",
  },
  ru: {
    headline: {
      good_now: "Прямо сейчас хорошее солнце",
      upcoming: "Ещё нет — окно откроется позже",
      window_closed: "Сегодняшнее окно уже закрылось",
      no_synthesis: "Сегодня солнце не даёт витамин D",
    },
    uv: "УФ-индекс", minutes: "нужно минут", window: "Окно", clouds: "облачность",
    threshold: "порог синтеза", empty: "Для этого места данные не получены.",
  },
  lt: {
    headline: {
      good_now: "Dabar saulė tinkama",
      upcoming: "Dar ne — langas atsidarys vėliau",
      window_closed: "Šiandienos langas jau užsidarė",
      no_synthesis: "Šiandien saulė vitamino D neduos",
    },
    uv: "UV indeksas", minutes: "reikia minučių", window: "Langas", clouds: "debesuotumas",
    threshold: "sintezės riba", empty: "Šiai vietai duomenų negauta.",
  },
};

export function resolveWidgetLocale(locale: unknown): WidgetLocale {
  if (typeof locale !== "string") return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? (base as WidgetLocale) : "en";
}

export function dayCurveStrings(locale: unknown): Copy {
  return COPY[resolveWidgetLocale(locale)];
}
