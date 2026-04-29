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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How much vitamin D can I produce in the sun compared to a pill?",
                "acceptedAnswer": { "@type": "Answer", "text": "A full-body exposure to 1 MED produces around 10,000–25,000 IU of vitamin D. A standard supplement capsule contains 400–2,000 IU. A 15–20 minute midday session in summer with arms and legs exposed can easily exceed a week of typical supplementation." },
              },
              {
                "@type": "Question",
                "name": "Can I overdose on vitamin D from the sun?",
                "acceptedAnswer": { "@type": "Answer", "text": "No. Solar synthesis is self-limiting. Once pre-vitamin D3 accumulates in the skin, continued UVB converts it into inert compounds — lumisterol and tachysterol. Your body never produces toxic levels from sun exposure." },
              },
              {
                "@type": "Question",
                "name": "What blood levels of 25-OH-D are considered optimal?",
                "acceptedAnswer": { "@type": "Answer", "text": "Below 20 ng/mL is deficient; 20–30 ng/mL is insufficient; 30–50 ng/mL is sufficient. The Endocrine Society considers 40–60 ng/mL optimal for non-skeletal benefits. Above 100 ng/mL carries toxicity risk from supplementation." },
              },
              {
                "@type": "Question",
                "name": "Why is K2 recommended alongside D3?",
                "acceptedAnswer": { "@type": "Answer", "text": "Vitamin D3 increases calcium absorption. Vitamin K2 (MK-7) activates osteocalcin (directs calcium into bones) and matrix Gla protein (prevents arterial calcification). If you supplement more than 1,000 IU/day of D3, 100–200 mcg of MK-7 is recommended." },
              },
              {
                "@type": "Question",
                "name": "When can I synthesize vitamin D from the sun?",
                "acceptedAnswer": { "@type": "Answer", "text": "Vitamin D synthesis requires a UV index of 3 or higher, which typically occurs when the sun is above 45–50° elevation. This depends on your latitude, time of year, and time of day. At latitudes above 35°N, synthesis is impossible during winter months." },
              },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
