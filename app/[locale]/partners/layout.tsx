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

  const descriptions: Record<string, string> = {
    es: "Llega a usuarios interesados en salud en el momento exacto en que necesitan suplementos de vitamina D. Modelos de patrocinio, afiliados y contenido co-marcado.",
    en: "Reach health-conscious users at the exact moment they need vitamin D supplements. Sponsorship, affiliate, and co-branded content models.",
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
