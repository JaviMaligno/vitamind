"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { alternatePathForLocale } from "@/i18n/locale-path";

const LANGUAGES = [
  { code: "es", label: "ES", name: "Español" },
  { code: "en", label: "EN", name: "English" },
  { code: "fr", label: "FR", name: "Français" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "lt", label: "LT", name: "Lietuvių" },
] as const;

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleChange = (lang: string) => {
    setOpen(false);
    // A path is not always the same path in another language: the city pages
    // localize both the route prefix and the slug, so /vitamina-d/madrid becomes
    // /en/vitamin-d/madrid. Reusing the current pathname and swapping only the
    // locale segment produced /en/vitamina-d/madrid, which 404s.
    //
    // Every page already emits the right URL per locale as an hreflang link, so
    // read the answer from there. Fall back to the current path for routes whose
    // path does not change across locales.
    const target = alternatePathForLocale(document, lang, routing.locales) ?? pathname;
    router.replace(target as Parameters<typeof router.replace>[0], { locale: lang });
  };

  const active = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      {/* Collapsed trigger: globe + active locale — one 44px control instead of
          six tiny language buttons crowding the mobile header. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={active.name}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-glass border border-glass-border px-3 text-text-secondary hover:text-text-primary transition-colors"
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span className="text-caption font-semibold">{active.label}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-border-default bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        >
          {LANGUAGES.map(({ code, name }) => (
            <button
              key={code}
              role="option"
              aria-selected={locale === code}
              onClick={() => handleChange(code)}
              className={`flex min-h-[44px] w-full items-center px-4 text-left text-body transition-colors ${
                locale === code
                  ? "bg-amber-400/15 text-accent font-semibold"
                  : "text-text-secondary hover:bg-surface-elevated"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
