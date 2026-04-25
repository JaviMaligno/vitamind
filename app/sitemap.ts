import type { MetadataRoute } from "next";

const BASE_URL = "https://vitamind-six.vercel.app";
const LOCALES = ["es", "en", "fr", "de", "ru", "lt"];

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/explore", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/dashboard", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "/learn", changeFrequency: "monthly" as const, priority: 0.9 },
    { path: "/profile", changeFrequency: "monthly" as const, priority: 0.4 },
    { path: "/partners", changeFrequency: "monthly" as const, priority: 0.6 },
  ];

  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, `${BASE_URL}${path}?locale=${locale}`])
      ),
    },
  }));
}
