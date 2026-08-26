"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { directoryTarget, cityPagePath, indexPath } from "@/lib/city-client-links";

/**
 * A link to the per-city SEO page that best fits the current place. Three states,
 * and none of them is silence (D-9):
 *
 *  1. the user's own builtin city, or one close enough in latitude that the page
 *     describes them anyway → "View the full {city} page", no distance;
 *  2. a stand-in city further off → "View the {city} page, {km} km away", so the
 *     substitution is stated rather than hidden;
 *  3. nothing worth offering → a link to the city index, which lists the closest
 *     candidates with their distances.
 *
 * The integer is `Math.round(km).toLocaleString(locale)`, the exact expression
 * `components/CityIndexSearch.tsx` uses, so one pair of coordinates cannot read
 * 188 km on one screen and 189 on the other (§4.4).
 *
 * Client-safe: the slug comes from the generated CITY_SLUGS map, so no message
 * file is bundled here.
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

  const target = directoryTarget(cityId, lat, lon);
  const cityHref = target.kind === "index" ? null : cityPagePath(target.base, locale);

  let href: string;
  let label: string;

  if (target.kind === "index" || !cityHref) {
    href = indexPath(locale);
    label = tCity("viewIndexInstead");
  } else {
    const name = tNames.has(target.base) ? tNames(target.base) : target.base;
    href = cityHref;
    label =
      target.kind === "exact" || target.silent
        ? tCity("viewCityPage", { city: name })
        : tCity("viewNearestCityPage", {
            city: name,
            km: Math.round(target.km).toLocaleString(locale),
          });
  }

  return (
    <Link
      href={href}
      className="inline-flex min-h-[36px] w-fit items-center gap-1.5 rounded-full border border-glass-border bg-glass px-3 text-caption font-medium text-accent shadow-sm backdrop-blur-md transition-colors hover:bg-surface-elevated"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </Link>
  );
}
