import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BUILTIN_CITIES } from "@/lib/cities";
import {
  CITY_PREFIX, baseSlug, localizedCityName, cityPathname,
  buildIndexAlternates, indexStaticParams,
} from "@/lib/city-routes";

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

export default async function CityIndexPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  if (!prefixMatchesLocale(p)) notFound();
  setRequestLocale(p.locale);

  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });

  // List every city, sorted by its name in this locale so the directory reads
  // alphabetically for the reader, not by the Spanish name.
  const cities = BUILTIN_CITIES.map((c) => {
    const base = baseSlug(c.id);
    return { base, name: localizedCityName(p.locale, base), href: cityPathname(p.locale, base) };
  }).sort((a, b) => a.name.localeCompare(b.name, p.locale));

  return (
    <main className="mx-auto max-w-[960px] px-4 py-6">
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

      <h1 className="text-2xl font-bold">{t("indexHeading")}</h1>
      <p className="mt-2 text-base opacity-80">{t("indexIntro")}</p>

      <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {cities.map((c) => (
          <li key={c.base}>
            <Link href={c.href} className="underline decoration-dotted">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
