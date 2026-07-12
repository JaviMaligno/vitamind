"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { targetCityBase, cityPagePath } from "@/lib/city-client-links";

/**
 * A direct link to the per-city SEO page that best fits the current place — the
 * selected city if it is a builtin one, else the nearest builtin within range.
 * Renders nothing when nothing is close enough. Client-safe: the slug comes from
 * the generated CITY_SLUGS map, so no message file is bundled here.
 */
export default function CityPageLink({
  cityId,
  lat,
  lon,
}: {
  cityId?: string;
  lat: number;
  lon: number;
}) {
  const locale = useLocale();
  const tCity = useTranslations("cityPage");
  const tNames = useTranslations("cities");

  const base = targetCityBase(cityId, lat, lon);
  if (!base) return null;
  const path = cityPagePath(base, locale);
  if (!path) return null;

  const name = tNames.has(base) ? tNames(base) : base;
  return (
    <Link href={path} className="text-accent underline decoration-dotted">
      {tCity("viewCityPage", { city: name })}
    </Link>
  );
}
