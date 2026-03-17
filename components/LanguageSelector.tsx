"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "ru", label: "RU" },
  { code: "lt", label: "LT" },
];

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();

  const handleChange = (lang: string) => {
    document.cookie = `locale=${lang};path=/;max-age=${365 * 24 * 60 * 60}`;
    router.refresh();
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
              : "bg-transparent text-white/25 hover:text-white/40"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
