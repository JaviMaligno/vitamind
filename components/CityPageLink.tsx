"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { directoryTarget, cityPagePath, indexPath } from "@/lib/city-client-links";

/**
 * A link to the per-city page that best fits the current place. Four states, and
 * none of them is silence (D-9):
 *
 *  1. the user's own builtin city, or one close enough in latitude that the page
 *     describes them anyway → "View the full {city} page", no distance;
 *  2. a stand-in city further off → "View the {city} page, {km} km away", so the
 *     substitution is stated rather than hidden;
 *  3. nothing worth offering → a link to the city index, which lists the closest
 *     candidates with their distances;
 *  4. a searched city, which PR B gave a page of its own → the same unqualified
 *     copy as (1), because nothing is being substituted any more.
 *
 * State 4 is the bug of origin closing: someone who searched Toledo used to be
 * offered "the full Madrid page" with no way to reach Toledo at all.
 *
 * It links through the `id-{geonameid}` alias rather than the canonical slug,
 * because the id is the only thing the saved preference carries — the route
 * redirects it. And it needs `cityName`: the searched city has no entry in the
 * `cities` message namespace, so the name has to come from the caller. Without
 * one there is nothing honest to print (`viewCityPage` with an empty `{city}`
 * reads "View the full  page"), so the chip falls back to states 1–3 rather than
 * degrade the copy.
 *
 * The integer in state 2 is `Math.round(km).toLocaleString(locale)`, the exact
 * expression `components/CityIndexSearch.tsx` uses, so one pair of coordinates
 * cannot read 188 km on one screen and 189 on the other (§4.4).
 *
 * Client-safe: the slug comes from the generated CITY_SLUGS map, so no message
 * file is bundled here.
 */
export default function CityPageLink({
  cityId,
  cityName,
  lat,
  lon,
}: {
  cityId?: string;
  /** Display name of the searched city; only state 4 can use it. */
  cityName?: string;
  lat: number;
  lon: number;
}) {
  const locale = useLocale();
  const tCity = useTranslations("cityPage");
  const tNames = useTranslations("cities");

  const resolved = directoryTarget(cityId, lat, lon);
  // Re-resolving from the coordinates alone is what "fall back to PR A" means:
  // `dynamic` is reachable only through a `geonames:` id, so dropping the id
  // cannot land here twice.
  const target =
    resolved.kind === "dynamic" && !cityName
      ? directoryTarget(undefined, lat, lon)
      : resolved;

  let href: string;
  let label: string;

  if (target.kind === "dynamic") {
    href = `${indexPath(locale)}/id-${target.geonameId}`;
    label = tCity("viewCityPage", { city: cityName as string });
  } else {
    const cityHref = target.kind === "index" ? null : cityPagePath(target.base, locale);
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
