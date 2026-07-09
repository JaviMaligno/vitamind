import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";

const PAGES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/explore", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/dashboard", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/learn", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/profile", changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/partners", changeFrequency: "monthly" as const, priority: 0.6 },
];

function languagesFor(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}${getPathname({ href: path, locale })}`;
  }
  // x-default → default-locale (es, prefix-free) version of the same path,
  // matching buildAlternates so hreflang reciprocity holds.
  languages["x-default"] = `${SITE_URL}${getPathname({ href: path, locale: routing.defaultLocale })}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${getPathname({ href: path, locale })}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: languagesFor(path) },
    })),
  );
}
