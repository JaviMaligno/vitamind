"use client";

import { useTranslations } from "next-intl";

/**
 * Returns a function to get the localized display name for a city.
 * - Builtin cities: translated via i18n messages ("cities" namespace)
 * - API/Nominatim/GPS cities: uses the name as-is (already localized from API)
 */
export function useCityDisplayName() {
  const t = useTranslations("cities");

  return (cityId: string, fallbackName: string): string => {
    if (!cityId.startsWith("builtin:")) return fallbackName;
    const slug = cityId.replace("builtin:", "");
    try {
      const translated = t(slug);
      return translated;
    } catch {
      return fallbackName;
    }
  };
}
