import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vitamina D Explorer",
  description: "Descubre cuando y donde puedes sintetizar vitamina D gracias al sol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
