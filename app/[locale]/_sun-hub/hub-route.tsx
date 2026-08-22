import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { localeForSunPrefix, resolveSunCityPage, sunCityStaticParams } from "@/lib/sun-routes";
import SunTodayPage, { sunTodayMetadata } from "./SunTodayPage";

/**
 * THE WIRING BEHIND THE SIX STATIC HUB FOLDERS, AND WHY THEY EXIST.
 *
 * The 240 today hubs (`/amanecer/madrid`) and the 438 vitamin D city pages
 * (`/vitamina-d/madrid`) used to be one route file, `[cityPrefix]/[city]`, told
 * apart inside the handler by their prefix. Next allows one dynamic segment name
 * per position, so sharing the segment looked mandatory.
 *
 * It was not. Route segment config (`revalidate`) is per FILE, and only the hubs
 * need an interval — their subject is today; the city pages are a pure function
 * of (city, DOY_REFERENCE_YEAR). One file meant one interval for all 678 pages,
 * and each ISR regeneration is a cache write on a free plan whose write quota
 * this project was already over. The 438 were paying for the 240.
 *
 * A STATIC route segment outranks a dynamic sibling, so the hubs can have route
 * folders of their own — `amanecer/[city]`, `sunrise/[city]`, one per value of
 * SUN_PREFIX — and the shared file keeps only the city pages, now frozen at
 * `revalidate = false`. Verified against this Next version's own sorter
 * (`next/dist/shared/lib/router/utils/sortable-routes`, which scores a static
 * segment 0 and a `[param]` 1 and sorts ascending) rather than from memory: for
 * `/es/amanecer/madrid` it ranks `/[locale]/amanecer/[city]` above
 * `/[locale]/[cityPrefix]/[city]`, and the 4-segment month URL
 * `/es/amanecer/madrid/agosto` still lands on `/[locale]/[cityPrefix]/[city]/[month]`
 * because matching walks a flat, sorted list of whole patterns — a static folder
 * is not a subtree that a deeper URL can get trapped in.
 *
 * THE TRAP THIS DESIGN SETS, AND ITS TRIPWIRE. Six folder names now duplicate
 * six values of SUN_PREFIX, and nothing in the type system connects them. Rename
 * a prefix, or add a seventh locale, and its hubs quietly stop being routed —
 * 40 URLs that are in the sitemap, are prerendered by nothing, and 404. That is
 * what app/__tests__/sun-hub-split.test.ts is for: it pins the folder set to
 * SUN_PREFIX, pins each folder's PREFIX literal to its own directory name, and
 * fails CI before a deploy can ship the hole. Do not delete it.
 */

export type HubParams = { locale: string; city: string };

/**
 * The starter cities for the one locale this prefix belongs to.
 *
 * Sliced out of `sunCityStaticParams()` instead of rebuilt from SUNRISE_CITIES,
 * so the union of the six folders' params is the same 240 triples the existing
 * tests in lib/__tests__/sun-today.test.ts already walk end to end.
 *
 * Throws on an unknown prefix rather than returning nothing: a folder whose
 * PREFIX no longer appears in SUN_PREFIX would otherwise prerender zero pages
 * and 404 every one of its URLs at runtime, which is a silent SEO outage. A
 * failed build is the cheap version of the same news.
 */
export function sunHubStaticParams(prefix: string): HubParams[] {
  if (!localeForSunPrefix(prefix)) {
    throw new Error(
      `[_sun-hub] "${prefix}" is not a value of SUN_PREFIX — the hub folder app/[locale]/${prefix}/[city] ` +
        `has no locale and would 404 every URL it owns. Rename the folder or restore the prefix.`,
    );
  }
  return sunCityStaticParams()
    .filter((p) => p.cityPrefix === prefix)
    .map(({ locale, city }) => ({ locale, city }));
}

/**
 * A static folder matches under EVERY locale, so `/en/amanecer/madrid` arrives
 * here at the Spanish folder with `locale = "en"`. `resolveSunCityPage` rejects
 * the mismatch (see its comment in lib/sun-routes.ts) and the URL 404s, exactly
 * as it did when a dynamic segment carried the prefix.
 */
export async function sunHubMetadata(
  prefix: string,
  params: Promise<HubParams>,
): Promise<Metadata> {
  const p = await params;
  const sun = resolveSunCityPage(p.locale, prefix, p.city);
  if (!sun) return {};
  return sunTodayMetadata(p.locale, sun);
}

export async function sunHubPage(prefix: string, params: Promise<HubParams>) {
  const p = await params;
  const sun = resolveSunCityPage(p.locale, prefix, p.city);
  if (!sun) notFound();
  setRequestLocale(p.locale);
  return <SunTodayPage locale={p.locale} resolved={sun} />;
}
