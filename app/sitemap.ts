import type { MetadataRoute } from "next";

const BASE_URL = "https://vitamind-bzytt4rn0-javieraguilar-6355s-projects.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
