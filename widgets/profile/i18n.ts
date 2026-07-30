export const WIDGET_LOCALES = ["en", "es", "fr", "de", "ru", "lt"] as const;
export type WidgetLocale = (typeof WIDGET_LOCALES)[number];

interface Copy {
  title: string;
  skin: string;
  skinHint: string;
  exposure: string;
  exposureLabels: [string, string, string, string];
  age: string;
  ageAny: string;
  target: string;
  minutes: string;
  burn: string;
  noSun: string;
  at: string;
  empty: string;
  saved: string;
  saving: string;
  saveFailed: string;
  contextOnly: string;
}

const COPY: Record<WidgetLocale, Copy> = {
  en: {
    title: "Your sun profile", skin: "Skin type", skinHint: "1 burns easily · 6 rarely burns",
    exposure: "Skin exposed", exposureLabels: ["Face + hands", "Face + arms", "T-shirt + shorts", "Swimsuit"],
    age: "Age", ageAny: "adult", target: "Target per session",
    minutes: "minutes to your target", burn: "until sunburn", noSun: "Not enough UV for synthesis",
    at: "at", empty: "No profile was returned.",
    saved: "Saved to your account", saving: "Saving…", saveFailed: "Could not save — shown for this chat only", contextOnly: "For this conversation only",
  },
  es: {
    title: "Tu perfil solar", skin: "Tipo de piel", skinHint: "1 se quema fácil · 6 rara vez",
    exposure: "Piel expuesta", exposureLabels: ["Cara + manos", "Cara + brazos", "Camiseta + short", "Bañador"],
    age: "Edad", ageAny: "adulto", target: "Objetivo por sesión",
    minutes: "minutos hasta tu objetivo", burn: "hasta quemarte", noSun: "UV insuficiente para sintetizar",
    at: "en", empty: "No se recibió ningún perfil.",
    saved: "Guardado en tu cuenta", saving: "Guardando…", saveFailed: "No se pudo guardar — vale solo para este chat", contextOnly: "Solo para esta conversación",
  },
  fr: {
    title: "Votre profil solaire", skin: "Type de peau", skinHint: "1 brûle vite · 6 rarement",
    exposure: "Peau exposée", exposureLabels: ["Visage + mains", "Visage + bras", "T-shirt + short", "Maillot"],
    age: "Âge", ageAny: "adulte", target: "Objectif par séance",
    minutes: "minutes pour l'objectif", burn: "avant le coup de soleil", noSun: "UV insuffisant pour la synthèse",
    at: "à", empty: "Aucun profil reçu.",
    saved: "Enregistré dans votre compte", saving: "Enregistrement…", saveFailed: "Échec — valable pour cette conversation seulement", contextOnly: "Pour cette conversation seulement",
  },
  de: {
    title: "Dein Sonnenprofil", skin: "Hauttyp", skinHint: "1 verbrennt schnell · 6 selten",
    exposure: "Freie Haut", exposureLabels: ["Gesicht + Hände", "Gesicht + Arme", "T-Shirt + Shorts", "Badeanzug"],
    age: "Alter", ageAny: "Erwachsen", target: "Ziel pro Einheit",
    minutes: "Minuten bis zum Ziel", burn: "bis Sonnenbrand", noSun: "Zu wenig UV für die Bildung",
    at: "in", empty: "Kein Profil empfangen.",
    saved: "In deinem Konto gespeichert", saving: "Speichern…", saveFailed: "Konnte nicht gespeichert werden — gilt nur für diesen Chat", contextOnly: "Nur für dieses Gespräch",
  },
  ru: {
    title: "Ваш солнечный профиль", skin: "Тип кожи", skinHint: "1 быстро сгорает · 6 почти нет",
    exposure: "Открытая кожа", exposureLabels: ["Лицо + кисти", "Лицо + руки", "Футболка + шорты", "Купальник"],
    age: "Возраст", ageAny: "взрослый", target: "Цель за сеанс",
    minutes: "минут до цели", burn: "до ожога", noSun: "УФ недостаточно для синтеза",
    at: "в", empty: "Профиль не получен.",
    saved: "Сохранено в аккаунте", saving: "Сохранение…", saveFailed: "Не удалось сохранить — только для этого чата", contextOnly: "Только для этого разговора",
  },
  lt: {
    title: "Jūsų saulės profilis", skin: "Odos tipas", skinHint: "1 greitai nudega · 6 beveik ne",
    exposure: "Atidengta oda", exposureLabels: ["Veidas + rankos", "Veidas + dilbiai", "Marškinėliai + šortai", "Maudymosi kostiumėlis"],
    age: "Amžius", ageAny: "suaugęs", target: "Tikslas per kartą",
    minutes: "minutės iki tikslo", burn: "iki nudegimo", noSun: "Per mažai UV sintezei",
    at: "vietovėje", empty: "Profilis negautas.",
    saved: "Išsaugota paskyroje", saving: "Saugoma…", saveFailed: "Nepavyko išsaugoti — galioja tik šiam pokalbiui", contextOnly: "Tik šiam pokalbiui",
  },
};

export function resolveWidgetLocale(locale: unknown): WidgetLocale {
  if (typeof locale !== "string") return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return (WIDGET_LOCALES as readonly string[]).includes(base) ? (base as WidgetLocale) : "en";
}

export function profileStrings(locale: unknown): Copy {
  return COPY[resolveWidgetLocale(locale)];
}
