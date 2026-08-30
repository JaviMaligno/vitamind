import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import VisitTracker from "@/components/VisitTracker";
import AppShell from "@/components/AppShell";
import { routing } from "@/i18n/routing";
import { pickClientMessages } from "@/i18n/client-messages";
import { buildAlternates } from "@/i18n/metadata";
import { SITE_URL, IS_PRODUCTION_DEPLOY } from "@/lib/site";
import SchemaScript from "@/components/SchemaScript";
import "../globals.css";
import "flag-icons/css/flag-icons.min.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const TITLES: Record<string, string> = {
  es: "Vitamina D Explorer — Sabe cuándo puedes sintetizar vitamina D con el sol",
  en: "Vitamin D Explorer — Know When You Can Synthesize Vitamin D from Sunlight",
  fr: "Vitamin D Explorer — Sachez quand synthétiser la vitamine D au soleil",
  de: "Vitamin D Explorer — Wissen, wann Sie Vitamin D durch Sonne bilden",
  ru: "Vitamin D Explorer — Узнайте, когда можно получить витамин D от солнца",
  lt: "Vitamin D Explorer — Sužinokite, kada galite gaminti vitaminą D saulėje",
};

const OG_LOCALES: Record<string, string> = {
  es: "es_ES", en: "en_US", fr: "fr_FR", de: "de_DE", ru: "ru_RU", lt: "lt_LT",
};

const DESCRIPTIONS: Record<string, string> = {
  es: "Calculadora solar de vitamina D gratuita. Descubre cuándo y cuánto tiempo tomar el sol según tu ubicación, tipo de piel, edad y datos UV en tiempo real.",
  en: "Free solar vitamin D calculator. Find out exactly when and how long to stay in the sun based on your location, skin type, age, and real-time UV data.",
  fr: "Calculateur solaire gratuit de vitamine D. Découvrez quand et combien de temps rester au soleil selon votre lieu, type de peau, âge et données UV en temps réel.",
  de: "Kostenloser Solar-Vitamin-D-Rechner. Erfahren Sie, wann und wie lange Sie sich je nach Standort, Hauttyp, Alter und Echtzeit-UV-Daten in der Sonne aufhalten sollten.",
  ru: "Бесплатный солнечный калькулятор витамина D. Узнайте, когда и как долго находиться на солнце в зависимости от местоположения, типа кожи, возраста и данных УФ.",
  lt: "Nemokamas saulės vitamino D skaičiuoklė. Sužinokite, kada ir kiek laiko būti saulėje pagal vietą, odos tipą, amžių ir realaus laiko UV duomenis.",
};

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const title = TITLES[locale] ?? TITLES.en;
  const description = DESCRIPTIONS[locale] ?? DESCRIPTIONS.en;
  const alternates = buildAlternates(locale, "/");

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: ["vitamin D", "solar calculator", "UV index", "vitamin D synthesis", "sun exposure", "supplement advice", "vitamin D deficiency", "skin type", "UVB"],
    manifest: "/manifest.json",
    alternates,
    openGraph: {
      title,
      description,
      type: "website",
      locale: OG_LOCALES[locale] ?? OG_LOCALES.en,
      alternateLocale: Object.values(OG_LOCALES).filter((l) => l !== (OG_LOCALES[locale] ?? OG_LOCALES.en)),
      url: alternates.canonical,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    robots: IS_PRODUCTION_DEPLOY ? { index: true, follow: true } : { index: false, follow: false },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "VitaminD" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#1a237e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function LocaleLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <SchemaScript locale={locale} description={DESCRIPTIONS[locale] ?? DESCRIPTIONS.en} />
      </head>
      <body style={{ margin: 0 }}>
        {/*
          Only the namespaces a client component can actually read. next-intl
          serialises whatever it is given into the RSC payload of every response,
          so handing it the whole file put all 34 namespaces — including the seven
          that only ever render on the server — into the HTML and .rsc of every
          page. Measured on production-build artifacts against what the live
          site was serving: 41-45 KB off the raw HTML of every response, a mean
          of -24% per page (the table is in i18n/client-messages.ts). Vercel
          bills ISR reads as crawled URLs × served bytes and the read meter sits
          near the Hobby ceiling, so this is bytes off the one limit that binds.

          Server components are unaffected: `useTranslations` /
          `getTranslations` inside a Server Component resolve against
          i18n/request.ts, which still loads the full file. `getMessages()` here
          is still the full object for the same reason — it is the server's copy.

          The set lives in i18n/client-messages.ts and is guarded two ways,
          because next-intl does NOT throw on a missing message: it renders the
          literal key path ("sunrisePage.vitdCta") into indexed HTML with a 200.
          i18n/__tests__/client-messages.test.ts re-derives the requirement from
          the client module graph, and
          components/__tests__/client-provider-subset.test.tsx renders the
          root-scoped callers through this same subset with a throwing onError.
        */}
        <NextIntlClientProvider messages={pickClientMessages(messages)} locale={locale}>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
        <Analytics />
        <VisitTracker />
      </body>
    </html>
  );
}
