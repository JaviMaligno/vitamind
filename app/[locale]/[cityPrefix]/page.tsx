import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
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
    <main className="mx-auto max-w-[1100px] px-4 py-6">
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

      <Card variant="glass">
        <h1 className="font-display text-display">{t("indexHeading")}</h1>
        <p className="mt-2 text-body text-text-secondary">{t("indexIntro")}</p>
      </Card>

      <div className="mt-6 space-y-6">
        {bands.map((band) => (
          <Card variant="glass" key={band.key}>
            <h2 className="font-display text-title">{t(band.headingKey)}</h2>
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {band.cities.map((c) => (
                <li key={c.base} className="flex min-h-[44px] items-center gap-2 text-body">
                  <span aria-hidden="true" className="text-lg">{c.flag}</span>
                  <A href={c.href}>{c.name}</A>
                  <span className="text-caption text-text-muted">· {c.datum}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
