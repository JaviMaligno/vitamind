import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  const titles: Record<string, string> = {
    es: "Explorar Vitamina D — Mapa Global de Síntesis Solar",
    en: "Explore Vitamin D — Global Solar Synthesis Map",
    fr: "Explorer la Vitamine D — Carte Mondiale de Synthèse Solaire",
    de: "Vitamin D erkunden — Globale Sonnensynthese-Karte",
    ru: "Исследуйте витамин D — Глобальная карта синтеза на солнце",
    lt: "Tyrinėkite vitaminą D — Pasaulinė saulės sintezės žemėlapis",
  };

  const descriptions: Record<string, string> = {
    es: "Descubre cuándo y dónde puedes sintetizar vitamina D. Calculadora solar personalizada por ubicación, tipo de piel y datos UV en tiempo real.",
    en: "Find out when and where you can synthesize vitamin D. Solar calculator personalized by location, skin type, and real-time UV data.",
    fr: "Découvrez quand et où vous pouvez synthétiser la vitamine D. Calculateur solaire personnalisé par localisation et type de peau.",
    de: "Finden Sie heraus, wann und wo Sie Vitamin D synthetisieren können. Sonnenrechner personalisiert nach Standort und Hauttyp.",
    ru: "Узнайте, когда и где вы можете синтезировать витамин D. Солнечный калькулятор по местоположению и типу кожи.",
    lt: "Sužinokite, kada ir kur galite sintetinti vitaminą D. Saulės skaičiuoklė pagal vietą ir odos tipą.",
  };

  return {
    title: titles[locale] ?? titles.en,
    description: descriptions[locale] ?? descriptions.en,
    openGraph: {
      title: titles[locale] ?? titles.en,
      description: descriptions[locale] ?? descriptions.en,
    },
  };
}

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
