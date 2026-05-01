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
