import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en", "fr", "de", "ru", "lt"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  localeDetection: true,
  // Reuse the existing cookie name so lib/locale.ts and PushLocaleSync stay valid.
  localeCookie: { name: "locale" },
});
