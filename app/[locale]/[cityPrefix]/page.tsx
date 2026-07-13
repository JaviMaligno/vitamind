import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import IndexHeroBold from "@/components/IndexHeroBold";
import { BUILTIN_CITIES } from "@/lib/cities";
import {
  CITY_PREFIX, baseSlug, localizedCityName, cityPathname,
  buildIndexAlternates, indexStaticParams,
} from "@/lib/city-routes";
import { cityYearProfile } from "@/lib/city-content";

export function generateStaticParams() {
  return indexStaticParams();
}

type Params = { locale: string; cityPrefix: string };

/** True only when the prefix is the one this locale uses (else the URL is bogus). */
function prefixMatchesLocale({ locale, cityPrefix }: Params): boolean {
  return cityPrefix === CITY_PREFIX[locale];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  if (!prefixMatchesLocale(p)) return {};

  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  const alternates = buildIndexAlternates(p.locale);
  const title = t("indexTitle");
  const description = t("indexDescription");

  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical, type: "website" },
  };
}

/**
 * Latitude band a city belongs to, keyed by |lat|. Latitude is the variable
 * that actually drives vitamin-D synthesis behaviour (winter darkness, all-year
 * sun), so the index groups by it instead of the alphabet.
 */
type BandKey = "veryHigh" | "high" | "mid" | "sub" | "trop";

const BANDS: { key: BandKey; headingKey: string }[] = [
  { key: "veryHigh", headingKey: "indexBandVeryHigh" },
  { key: "high", headingKey: "indexBandHigh" },
  { key: "mid", headingKey: "indexBandMid" },
  { key: "sub", headingKey: "indexBandSub" },
  { key: "trop", headingKey: "indexBandTrop" },
];

function bandForLat(lat: number): BandKey {
  const abs = Math.abs(lat);
  if (abs >= 55) return "veryHigh";
  if (abs >= 45) return "high";
  if (abs >= 35) return "mid";
  if (abs >= 23.5) return "sub";
  return "trop";
}

export default async function CityIndexPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  if (!prefixMatchesLocale(p)) notFound();
  setRequestLocale(p.locale);

  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });

  // Every city, enriched with its localized name/href and a one-line datum
  // (months of viable sun, all-year, or never) derived from the same solar
  // model the city detail page uses.
  const cities = BUILTIN_CITIES.map((c) => {
    const base = baseSlug(c.id);
    const profile = cityYearProfile(c.lat, c.lon, c.elevation ?? 0);
    const datum = profile.allYear
      ? t("indexAllYear")
      : profile.neverPossible
        ? t("indexNever")
        : t("indexMonths", { count: profile.possibleMonths.length });

    return {
      base,
      name: localizedCityName(p.locale, base),
      href: cityPathname(p.locale, base),
      flag: c.flag,
      band: bandForLat(c.lat),
      datum,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, p.locale));

  const bands = BANDS.map((band) => ({
    ...band,
    cities: cities.filter((c) => c.band === band.key),
  })).filter((band) => band.cities.length > 0);

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t("indexTitle"),
            hasPart: cities.map((c) => ({
              "@type": "WebPage",
              name: c.name,
              url: `https://getvitamind.app${c.href}`,
            })),
          }),
        }}
      />

      <IndexHeroBold
        eyebrow={t("indexEyebrow")}
        title={t("indexHeading")}
        intro={t("indexIntro")}
        count={cities.length}
        countLabel={t("indexCitiesLabel")}
      />

      <div className="mt-10 space-y-8 sm:mt-16 sm:space-y-10">
        {bands.map((band) => (
          <section key={band.key}>
            <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl tracking-tight text-text-primary">
              {t(band.headingKey)}
            </h2>
            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {band.cities.map((c) => (
                <li key={c.base}>
                  <Link
                    href={c.href}
                    className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-glass border border-glass-border backdrop-blur-md px-4 py-3 shadow-lg transition-colors hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-sun"
                  >
                    <span aria-hidden="true" className="text-2xl">{c.flag}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body font-semibold text-text-primary">{c.name}</span>
                      <span className="text-caption text-text-muted">{c.datum}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
