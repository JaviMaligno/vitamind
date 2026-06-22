import { getRequestConfig } from "next-intl/server";
import { pickLocale } from "@/lib/accept-language";

const SUPPORTED_LOCALES = ["es", "en", "fr", "de", "ru", "lt"] as const;
const DEFAULT_LOCALE = "es";

export default getRequestConfig(async () => {
  const { cookies, headers } = await import("next/headers");
  const cookieStore = await cookies();

  // Explicit user choice (LanguageSelector) always wins. Otherwise fall back to
  // the browser's Accept-Language, and only then to Spanish — so a first-time
  // visitor sees the app (and receives push notifications) in their own language
  // instead of always Spanish.
  const cookieLocale = cookieStore.get("locale")?.value;
  let locale: string;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as (typeof SUPPORTED_LOCALES)[number])) {
    locale = cookieLocale;
  } else {
    const headerStore = await headers();
    locale = pickLocale(headerStore.get("accept-language"), SUPPORTED_LOCALES, DEFAULT_LOCALE);
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
