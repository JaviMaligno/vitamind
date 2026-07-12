"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { alternatePathForLocale } from "@/i18n/locale-path";

const LANGUAGES = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "ru", label: "RU" },
  { code: "lt", label: "LT" },
] as const;

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (lang: string) => {
    // A path is not always the same path in another language: the city pages
    // localize both the route prefix and the slug, so /vitamina-d/madrid becomes
    // /en/vitamin-d/madrid. Reusing the current pathname and swapping only the
    // locale segment produced /en/vitamina-d/madrid, which 404s.
    //
    // Every page already emits the right URL per locale as an hreflang link, so
    // read the answer from there. Fall back to the current path for routes whose
    // path does not change across locales.
    const target = alternatePathForLocale(document, lang, routing.locales) ?? pathname;

    // next-intl re-adds the locale prefix and persists the `locale` cookie.
    router.replace(target as Parameters<typeof router.replace>[0], { locale: lang });
  };

  return (
    <div className="flex gap-0.5 items-center">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-colors ${
            locale === code
              ? "bg-amber-400/15 text-accent font-semibold"
              : "bg-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
