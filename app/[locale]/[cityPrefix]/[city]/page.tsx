import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CityYearStrip from "@/components/CityYearStrip";
import NotificationToggle from "@/components/NotificationToggle";
import { BUILTIN_CITIES } from "@/lib/cities";
import {
  cityYearProfile, citySeasonalWindows, contiguousMonthRange, viableDateBoundaries,
} from "@/lib/city-content";
import {
  CITY_PREFIX, baseSlug, cityIdFromSlug, localizedCityName, cityPathname,
  buildCityAlternates, cityStaticParams, indexPathname,
} from "@/lib/city-routes";
import { nearbyCities } from "@/lib/city-nearby";
import { capFirst, cityLabels, monthLabels, monthName, verdictMonths } from "@/lib/city-copy";
import { fmtTime, dateFromDoy } from "@/lib/solar";

export function generateStaticParams() {
  return cityStaticParams();
}

type Params = { locale: string; cityPrefix: string; city: string };

/** Resolves (locale, prefix, slug) → the City, or null when the route is bogus. */
function resolveCity({ locale, cityPrefix, city }: Params) {
  if (cityPrefix !== CITY_PREFIX[locale]) return null;
  const cityId = cityIdFromSlug(locale, city);
  if (!cityId) return null;
  return BUILTIN_CITIES.find((c) => c.id === cityId) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const city = resolveCity(p);
  if (!city) return {};

  const base = baseSlug(city.id);
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  // next-intl's untyped `t` wants Record<string, ...>; CityLabels is an interface
  // (no implicit index signature), so widen via a fresh literal. Values unchanged.
  const labels: Record<string, string> = { ...cityLabels(p.locale, localizedCityName(p.locale, base)) };
  const alternates = buildCityAlternates(p.locale, base);

  const title = t("title", labels);
  const description = t("metaDescription", labels);

  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const city = resolveCity(p);
  if (!city) notFound();
  setRequestLocale(p.locale);

  const base = baseSlug(city.id);
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });

  // Every value a cityPage template may reference. Each locale uses the subset it
  // needs — ICU ignores extras but throws on a missing one, so pass the superset.
  // Spread into a fresh literal: next-intl's `t` wants a Record, and an interface
  // has no implicit index signature. Type-only — the values are unchanged.
  const labels: Record<string, string> = { ...cityLabels(p.locale, localizedCityName(p.locale, base)) };

  // The synthesis threshold depends on ozone (latitude, longitude, season) and on
  // altitude, so the city's real position and elevation must both be passed.
  const elevationM = city.elevation ?? 0;
  const profile = cityYearProfile(city.lat, city.lon, elevationM);
  const windows = citySeasonalWindows(city.lat, city.lon, city.tz, elevationM);
  const labelsForChart = monthLabels(p.locale);

  // The month band hides the shoulder; this names the first and last day with at
  // least 30 minutes of viable sun. Rendered only when there is a real winter --
  // Sydney is allYear by the month rule yet still has a boundary.
  const bounds =
    profile.allYear || profile.neverPossible ? null : viableDateBoundaries(profile.hoursByDay);
  const dateRange = bounds
    ? new Intl.DateTimeFormat(p.locale, { day: "numeric", month: "long" })
        // Both endpoints are pinned to the same reference year. A southern band
        // wraps past January, and real cross-year dates would make formatRange
        // print a fabricated "2026 – 2027" on a pattern that repeats every year.
        .formatRange(dateFromDoy(bounds.startDoy), dateFromDoy(bounds.endDoy))
    : null;

  // Circular band: southern-hemisphere cities wrap around January.
  const possibleBand = contiguousMonthRange(profile.possibleMonths);
  const impossibleBand = contiguousMonthRange(profile.impossibleMonths);

  const nearby = nearbyCities(city.id);

  const verdict = profile.allYear
    ? t("verdictAllYear", labels)
    : profile.neverPossible
      ? t("verdictNever", labels)
      : t("verdictRange", {
          ...labels,
          ...verdictMonths(p.locale, possibleBand!.start - 1, possibleBand!.end - 1),
        });

  const summerWindow = windows.find((w) => w.possible && w.minutesNeeded !== null);

  const faq = [
    {
      "@type": "Question",
      name: t("faqWinterQ", labels),
      acceptedAnswer: { "@type": "Answer", text: verdict },
    },
    ...(summerWindow
      ? [{
          "@type": "Question",
          name: t("faqMinutesQ", labels),
          acceptedAnswer: {
            "@type": "Answer",
            // A number, not a string: lt selects an ICU plural form on it.
            text: t("faqMinutesA", { ...labels, minutes: Math.round(summerWindow.minutesNeeded!) }),
          },
        }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-[960px] px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq }),
        }}
      />

      <h1 className="text-2xl font-bold">{t("title", labels)}</h1>
      <p className="mt-2 text-base">{verdict}</p>
      {!profile.allYear && !profile.neverPossible && impossibleBand && (
        <p className="mt-1 text-sm opacity-80">
          {t("impossibleRange", {
            ...labels,
            ...verdictMonths(p.locale, impossibleBand.start - 1, impossibleBand.end - 1),
          })}
        </p>
      )}
      {dateRange && (
        <p className="mt-1 text-xs opacity-60">{t("exactWindow", { dateRange })}</p>
      )}

      <section className="mt-6">
        <p className="text-sm">{t("notifyLead", labels)}</p>
        <div className="mt-2">
          <NotificationToggle
            lat={city.lat}
            lon={city.lon}
            tz={city.tz}
            timezone={city.timezone}
            skinType={3}
            areaFraction={0.25}
            cityName={localizedCityName(p.locale, base)}
            labelOff={t("notifyOff")}
            labelOn={t("notifyOn")}
            prominent
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("yearHeading", labels)}</h2>
        <div className="mt-3">
          <CityYearStrip hoursByDay={profile.hoursByDay} monthLabels={labelsForChart} caption={t("yearCaption")} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("seasonHeading")}</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {windows.map((w) => (
            // These lines start with the month, so it must be capitalized —
            // es/fr/ru/lt all yield a lowercase nominative from Intl.
            <li key={w.doy}>
              {w.possible
                ? t("seasonWindow", {
                    month: capFirst(monthName(p.locale, w.monthIndex)),
                    start: fmtTime(w.windowStart!),
                    end: fmtTime(w.windowEnd!),
                    minutes: Math.round(w.minutesNeeded!),
                  })
                : t("seasonImpossible", { month: capFirst(monthName(p.locale, w.monthIndex)) })}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-60">{t("seasonNote")}</p>
      </section>

      {!profile.allYear && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("supplementHeading", labels)}</h2>
          <p className="mt-2 text-sm">
            <Link href="/learn#supplement" className="underline decoration-dotted">
              {t("supplementBody")}
            </Link>
          </p>
        </section>
      )}

      <section className="mt-8">
        <Link
          href="/dashboard"
          className="inline-block rounded bg-amber-400/15 px-4 py-2 text-sm font-semibold text-accent"
        >
          {t("ctaLabel", labels)}
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("faqHeading", labels)}</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {faq.map((q) => (
            <div key={q.name}>
              <dt className="font-medium">{q.name}</dt>
              <dd className="opacity-80">{q.acceptedAnswer.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Cross-links to the nearest cities: turns the 438 pages into a crawlable
          mesh and gives the reader somewhere to go. Static, so Google follows it. */}
      <nav className="mt-10">
        <h2 className="text-lg font-semibold">{t("nearbyHeading")}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {nearby.map((nb) => {
            const nbBase = baseSlug(nb.id);
            return (
              <li key={nb.id}>
                <Link href={cityPathname(p.locale, nbBase)} className="underline decoration-dotted">
                  {localizedCityName(p.locale, nbBase)}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm">
          <Link href={indexPathname(p.locale)} className="font-medium text-accent underline decoration-dotted">
            {t("allCitiesLink")} →
          </Link>
        </p>
      </nav>
    </main>
  );
}
