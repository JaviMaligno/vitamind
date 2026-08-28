import type { Metadata } from "next";
import { authorship } from "@/lib/schema";
import { getMessages, setRequestLocale } from "next-intl/server";
import { buildAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const FAQ_BLOCKS = [
  { id: "block1", questions: 7 },
  { id: "block2", questions: 5 },
  { id: "block3", questions: 6 },
  { id: "block4", questions: 5 },
] as const;

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;

  /**
   * REFOCUSED ON THE MECHANISM, 2026-08-28. Spec §5.
   *
   * This page used to be titled "Complete Guide to Vitamin D", which put it
   * against MedlinePlus and university hospitals for the entry query — a fight
   * that cannot be won with 19 inbound links, 12 of them our own. It also
   * duplicated an intent it does not serve: the 29 answers explain WHY (why UVB
   * and not UVA, why glass blocks it, what the UV index means) and not one of
   * them answers "how long", which is the query with the volume.
   *
   * That query now has pages of its own — `/cuanto-sol-vitamina-d` and its three
   * bands — so this page stops competing for it and claims what it actually
   * covers. The 29 answers, the FAQPage markup and the URL are untouched: only
   * the title, the description and the framing move.
   */
  const titles: Record<string, string> = {
    es: "Cómo funciona la vitamina D del sol — el mecanismo, explicado",
    en: "How vitamin D from the sun works — the mechanism, explained",
    fr: "Comment fonctionne la vitamine D du soleil — le mécanisme expliqué",
    de: "Wie Vitamin D aus der Sonne entsteht — der Mechanismus erklärt",
    ru: "Как работает витамин D от солнца — механизм, объяснённый",
    lt: "Kaip veikia vitaminas D iš saulės — mechanizmas paaiškintas",
  };

  const descriptions: Record<string, string> = {
    es: "Por qué solo el UVB sirve, por qué el cristal lo bloquea y qué significa el índice UV. El mecanismo detrás de la síntesis solar, en 29 respuestas. Para saber cuánto tiempo necesitas, la respuesta está en su propia página.",
    en: "Why only UVB works, why glass blocks it and what the UV index means. The mechanism behind solar synthesis, in 29 answers. For how long you actually need, that answer has a page of its own.",
    fr: "Pourquoi seul l'UVB fonctionne, pourquoi le verre le bloque et ce que signifie l'indice UV. Le mécanisme de la synthèse solaire, en 29 réponses. Pour la durée, la réponse a sa propre page.",
    de: "Warum nur UVB wirkt, warum Glas es blockiert und was der UV-Index bedeutet. Der Mechanismus hinter der Sonnensynthese, in 29 Antworten. Wie lange Sie brauchen, steht auf einer eigenen Seite.",
    ru: "Почему работает только UVB, почему стекло его задерживает и что означает УФ-индекс. Механизм солнечного синтеза в 29 ответах. Сколько нужно времени — на отдельной странице.",
    lt: "Kodėl veikia tik UVB, kodėl stiklas jį sulaiko ir ką reiškia UV indeksas. Saulės sintezės mechanizmas 29 atsakymuose. Kiek laiko reikia — atsakymas turi savo puslapį.",
  };

  return {
    title: titles[locale] ?? titles.en,
    description: descriptions[locale] ?? descriptions.en,
    alternates: buildAlternates(locale, "/learn"),
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

export default async function LearnLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
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
            ...authorship(),
            mainEntity,
          }),
        }}
      />
      {children}
    </>
  );
}
