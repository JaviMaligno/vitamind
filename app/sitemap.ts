import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { buildLanguageAlternates } from "@/i18n/metadata";
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug, cityUrl, buildCityAlternates } from "@/lib/city-routes";

const PAGES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/explore", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/dashboard", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/learn", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/connect", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/profile", changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/partners", changeFrequency: "monthly" as const, priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries = PAGES.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${getPathname({ href: path, locale })}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: buildLanguageAlternates(path) },
    })),
  );

  // 73 builtin cities × 6 locales. Slugs and prefixes are localized, so each
  // locale's URL is distinct and its alternates point at the same city elsewhere.
  const cityEntries = BUILTIN_CITIES.flatMap((city) => {
    const base = baseSlug(city.id);
    return routing.locales.map((locale) => ({
      url: cityUrl(locale, base),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: buildCityAlternates(locale, base).languages },
    }));
  });

  return [...staticEntries, ...cityEntries];
}
