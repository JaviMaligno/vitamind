import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";

const FAQ_BLOCKS = [
  { id: "block1", questions: 7 },
  { id: "block2", questions: 5 },
  { id: "block3", questions: 6 },
  { id: "block4", questions: 5 },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  const titles: Record<string, string> = {
    es: "Aprende sobre Vitamina D — Guía Completa de Síntesis Solar y Suplementación",
    en: "Learn about Vitamin D — Complete Guide to Solar Synthesis & Supplementation",
    fr: "Apprendre sur la Vitamine D — Guide Complet de Synthèse Solaire",
    de: "Vitamin D lernen — Vollständiger Leitfaden zur Sonnensynthese",
    ru: "Узнайте о витамине D — Полное руководство по синтезу на солнце",
    lt: "Sužinokite apie vitaminą D — Pilnas saulės sintezės vadovas",
  };

  const descriptions: Record<string, string> = {
    es: "Todo sobre la vitamina D: síntesis solar, suplementación con D3/K2/magnesio, dosis recomendadas, niveles óptimos en sangre, y beneficios del sol más allá de la vitamina D.",
    en: "Everything about vitamin D: solar synthesis, D3/K2/magnesium supplementation, recommended doses, optimal blood levels, and sun benefits beyond vitamin D.",
    fr: "Tout sur la vitamine D : synthèse solaire, supplémentation D3/K2/magnésium, doses recommandées et bienfaits du soleil.",
    de: "Alles über Vitamin D: Sonnensynthese, D3/K2/Magnesium-Supplementierung, empfohlene Dosen und Vorteile der Sonne.",
    ru: "Всё о витамине D: солнечный синтез, добавки D3/K2/магний, рекомендуемые дозы и польза солнца.",
    lt: "Viskas apie vitaminą D: saulės sintezė, D3/K2/magnio papildai, rekomenduojamos dozės ir saulės nauda.",
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

type LearnMessages = {
  [block: string]: {
    [question: string]: { q?: string; a?: string };
  };
};

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const messages = (await getMessages()) as { learn?: LearnMessages };
  const learn = messages.learn ?? {};

  const mainEntity = FAQ_BLOCKS.flatMap((block) =>
    Array.from({ length: block.questions }, (_, i) => i + 1)
      .map((n) => {
        const node = learn[block.id]?.[`q${n}`];
        if (!node?.q || !node?.a) return null;
        return {
          "@type": "Question",
          name: node.q,
          acceptedAnswer: { "@type": "Answer", text: node.a },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity,
          }),
        }}
      />
      {children}
    </>
  );
}
