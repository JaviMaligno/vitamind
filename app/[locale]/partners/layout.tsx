import type { Metadata } from "next";
import { buildAlternates } from "@/i18n/metadata";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    es: "Colabora con Vitamina D Explorer — Partnerships para Marcas de Salud",
    en: "Partner with Vitamina D Explorer — Health Brand Partnerships",
  };

  /**
   * These have to say the same thing the page says. The body stopped promising an
   * audience on 2026-08-26 — it was the claim that invited "come back when you
   * have users" — but this description is hardcoded here rather than read from
   * `messages`, so it survived the rewrite and kept selling the audience in the
   * one place search engines and AI assistants actually quote. The visible page
   * was honest and the snippet was not, which is the worse half to get wrong.
   */
  const descriptions: Record<string, string> = {
    es: "Miles de páginas indexadas en seis idiomas que responden a quien busca cuándo puede sintetizar vitamina D. Modelos de patrocinio, afiliados y contenido co-marcado.",
    en: "Thousands of indexed pages in six languages answering people who want to know when they can synthesize vitamin D. Sponsorship, affiliate, and co-branded content models.",
  };

  return {
    title: titles[locale] ?? titles.en,
    description: descriptions[locale] ?? descriptions.en,
    alternates: buildAlternates(locale, "/partners"),
    openGraph: {
      title: titles[locale] ?? titles.en,
      description: descriptions[locale] ?? descriptions.en,
    },
  };
}

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
