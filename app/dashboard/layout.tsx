import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  const titles: Record<string, string> = {
    es: "Mi Vitamina D — Panel de Seguimiento Solar Diario",
    en: "My Vitamin D — Daily Solar Tracking Dashboard",
    fr: "Ma Vitamine D — Tableau de Bord de Suivi Solaire",
    de: "Mein Vitamin D — Tägliches Solar-Tracking-Dashboard",
    ru: "Мой витамин D — Ежедневная панель мониторинга",
    lt: "Mano vitaminas D — Kasdienė saulės stebėjimo skydelis",
  };

  const descriptions: Record<string, string> = {
    es: "Tu panel personalizado de vitamina D: historial de síntesis, previsión a 5 días, y recomendaciones diarias basadas en tu ubicación y tipo de piel.",
    en: "Your personalized vitamin D dashboard: synthesis history, 5-day forecast, and daily recommendations based on your location and skin type.",
    fr: "Votre tableau de bord vitamine D personnalisé : historique de synthèse, prévisions sur 5 jours et recommandations quotidiennes.",
    de: "Ihr persönliches Vitamin-D-Dashboard: Synthesehistorie, 5-Tage-Prognose und tägliche Empfehlungen.",
    ru: "Ваша персональная панель витамина D: история синтеза, прогноз на 5 дней и ежедневные рекомендации.",
    lt: "Jūsų personalizuota vitamino D skydelis: sintezės istorija, 5 dienų prognozė ir kasdienės rekomendacijos.",
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
