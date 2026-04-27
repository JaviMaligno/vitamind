import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import AppShell from "@/components/AppShell";
import { SITE_URL, IS_PRODUCTION_DEPLOY } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Vitamina D Explorer — Know When You Can Synthesize Vitamin D from Sunlight",
  description: "Free solar vitamin D calculator. Find out exactly when and how long to stay in the sun based on your location, skin type, age, and real-time UV data. Science-based estimates using Holick/Dowdy models.",
  keywords: ["vitamin D", "solar calculator", "UV index", "vitamin D synthesis", "sun exposure", "supplement advice", "vitamin D deficiency", "skin type", "UVB"],
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Vitamina D Explorer — Know When You Can Synthesize Vitamin D",
    description: "Enter your city, skin type & age. Get personalized sun exposure times, 5-day forecasts, and supplement advice — all based on real UV data and peer-reviewed science.",
    type: "website",
    locale: "es_ES",
    alternateLocale: ["en_US", "fr_FR", "de_DE"],
    url: SITE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Vitamina D Explorer — Solar Vitamin D Calculator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitamina D Explorer — Solar Vitamin D Calculator",
    description: "Know exactly when & how long to stay in the sun for your vitamin D. Free, science-based, works worldwide. 6 languages.",
    images: ["/og-image.png"],
  },
  robots: IS_PRODUCTION_DEPLOY
    ? { index: true, follow: true }
    : { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VitaminD",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a237e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Vitamina D Explorer",
              "url": SITE_URL,
              "description": "Free solar vitamin D calculator. Find out exactly when and where you can synthesize vitamin D based on your location, skin type, and real-time UV data.",
              "applicationCategory": "HealthApplication",
              "operatingSystem": "Any",
              "inLanguage": ["es", "en", "fr", "de", "ru", "lt"],
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
              "featureList": "Real-time UV synthesis windows, Personalized skin type calculator, 5-day forecast, Global heatmap, Push notifications, Multi-language support",
            }),
          }}
        />
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
      </head>
      <body style={{ margin: 0 }}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW registered:', reg.scope))
                    .catch(err => console.warn('SW registration failed:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
