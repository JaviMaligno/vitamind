import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/react";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vitamind-bzytt4rn0-javieraguilar-6355s-projects.vercel.app"),
  title: "Vitamina D Explorer — Know When You Can Synthesize Vitamin D",
  description: "Free solar vitamin D calculator. Find out exactly when and where you can synthesize vitamin D based on your location, skin type, and real-time UV data.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Vitamina D Explorer",
    description: "Know when and where you can synthesize vitamin D from sunlight",
    type: "website",
    locale: "es_ES",
    alternateLocale: ["en_US", "fr_FR", "de_DE"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitamina D Explorer",
    description: "Free solar vitamin D calculator based on your location and skin type",
  },
  robots: { index: true, follow: true },
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
              "description": "Solar vitamin D synthesis calculator",
              "applicationCategory": "HealthApplication",
              "operatingSystem": "Any",
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
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
