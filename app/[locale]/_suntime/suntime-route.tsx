import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import {
  BANDS,
  BAND_SLUGS,
  buildSuntimeAlternates,
  buildSuntimeBandAlternates,
  localeForSuntimePrefix,
  resolveSuntimeBandPage,
  resolveSuntimePage,
} from "@/lib/suntime-routes";
import { routing } from "@/i18n/routing";
import SuntimePage, { suntimeMeta } from "./SuntimePage";

/**
 * THE WIRING BEHIND THE TWELVE STATIC FOLDERS, AND WHY THEY ARE STATIC.
 *
 * `app/[locale]/[cityPrefix]/` already occupies the first position under the
 * locale, and Next allows one slug name per position — so `[suntimePrefix]`
 * cannot exist beside it. A STATIC route segment outranks a dynamic sibling, so
 * these pages get a folder per locale instead: `cuanto-sol-vitamina-d/`,
 * `how-long-in-sun-vitamin-d/`, and one per value of SUNTIME_PREFIX, each with
 * a `[band]` child. The sunrise hubs already do this for a different reason
 * (see app/[locale]/_sun-hub/hub-route.tsx), which is where the evidence about
 * this Next version's route sorter lives.
 *
 * A static folder is ALSO matched under every locale, so `/en/cuanto-sol-vitamina-d`
 * arrives at the Spanish folder with `locale = "en"`. `resolveSuntimePage`
 * rejects the mismatch and the URL 404s — without that check it would serve the
 * English page at a Spanish path, a duplicate whose canonical points away from
 * itself.
 *
 * THE TRAP, and its tripwire. Twelve directory names now duplicate six values
 * of SUNTIME_PREFIX with nothing in the type system connecting them. Rename a
 * prefix and four pages per locale stop being routed while the sitemap keeps
 * listing them. `app/__tests__/suntime-pages.test.ts` reassembles the set from
 * disk in both directions and fails CI first. Do not delete it.
 */

export type MotherParams = { locale: string };
export type BandParams = { locale: string; band: string };

function assertKnown(prefix: string): void {
  if (!localeForSuntimePrefix(prefix)) {
    throw new Error(
      `[_suntime] "${prefix}" is not a value of SUNTIME_PREFIX — the folder ` +
        `app/[locale]/${prefix} has no locale and would 404 every URL it owns. ` +
        `Rename the folder or restore the prefix.`,
    );
  }
}

/**
 * The one locale this prefix belongs to.
 *
 * Only that locale is prerendered, not all six: the other five would render a
 * `notFound()` — a static folder matches under every locale — and Next writes
 * an unlisted-param 404 to the full route cache, which is precisely the write
 * this project cannot afford (the measurement is in
 * i18n/on-demand-city-rewrite.ts). Listing one param per folder means the five
 * wrong-locale URLs are never built and never requested by anything that links
 * here.
 *
 * Throws on an unknown prefix rather than returning nothing, so a renamed
 * folder is a failed build instead of a silent SEO hole.
 */
export function suntimeMotherParams(prefix: string): MotherParams[] {
  assertKnown(prefix);
  return routing.locales
    .filter((locale) => resolveSuntimePage(locale, prefix))
    .map((locale) => ({ locale }));
}

/** The same, times the three band slugs of that locale. */
export function suntimeBandParams(prefix: string): BandParams[] {
  assertKnown(prefix);
  return routing.locales
    .filter((locale) => resolveSuntimePage(locale, prefix))
    .flatMap((locale) => BANDS.map((band) => ({ locale, band: BAND_SLUGS[locale][band] })));
}

export async function suntimeMotherMetadata(
  prefix: string,
  params: Promise<MotherParams>,
): Promise<Metadata> {
  const p = await params;
  if (!resolveSuntimePage(p.locale, prefix)) return {};
  const { title, description } = await suntimeMeta(p.locale);
  const alternates = buildSuntimeAlternates(p.locale);
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
}

export async function suntimeBandMetadata(
  prefix: string,
  params: Promise<BandParams>,
): Promise<Metadata> {
  const p = await params;
  const band = resolveSuntimeBandPage(p.locale, prefix, p.band);
  if (!band) return {};
  const { title, description } = await suntimeMeta(p.locale, band);
  const alternates = buildSuntimeBandAlternates(p.locale, band);
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
}

export async function suntimeMotherRoute(prefix: string, params: Promise<MotherParams>) {
  const p = await params;
  if (!resolveSuntimePage(p.locale, prefix)) notFound();
  setRequestLocale(p.locale);
  return <SuntimePage locale={p.locale} />;
}

export async function suntimeBandRoute(prefix: string, params: Promise<BandParams>) {
  const p = await params;
  const band = resolveSuntimeBandPage(p.locale, prefix, p.band);
  if (!band) notFound();
  setRequestLocale(p.locale);
  return <SuntimePage locale={p.locale} band={band} />;
}
