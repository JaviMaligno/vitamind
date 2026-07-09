// Root layout is a passthrough: the <html>/<body> live in app/[locale]/layout.tsx
// (required by the next-intl as-needed setup, where the default locale has no
// URL prefix). Next may warn about a root layout without <html>; this is expected
// and documented for this i18n pattern.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
