"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

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
    // Navigate to the same page in the chosen language; next-intl persists the
    // preference in the `locale` cookie automatically.
    router.replace(pathname, { locale: lang });
  };

  return (
    <div className="flex gap-0.5 items-center">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-colors ${
            locale === code
              ? "bg-amber-400/15 text-amber-400 font-semibold"
              : "bg-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
