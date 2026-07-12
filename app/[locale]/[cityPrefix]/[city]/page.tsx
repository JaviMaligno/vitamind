import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CityHero from "@/components/CityHero";
import CityYearStrip from "@/components/CityYearStrip";
import NotificationToggle from "@/components/NotificationToggle";
import Card from "@/components/ui/Card";
import VerdictBadge from "@/components/ui/VerdictBadge";
import A from "@/components/ui/A";
import { SunArc } from "@/components/ui/Icon";
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

// Primary CTA styled like <Button variant="primary"> (see components/ui/Button.tsx)
// but rendered as the i18n Link itself, so it stays a valid, navigable anchor.
const ctaClasses =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-body font-semibold " +
  "transition-colors bg-sun text-white hover:bg-sun-strong";

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
    <main className="mx-auto max-w-[1100px] px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq }),
        }}
      />

      {/* Hero: the city's live sky (phase gradient) as a contained band, with the
          headline content in a glass card on top so text stays legible. */}
      <CityHero lat={city.lat} lon={city.lon}>
        <h1 className="font-display text-display">{t("title", labels)}</h1>

        <div className="mt-3">
          <VerdictBadge tone={!profile.neverPossible ? "possible" : "winter"}>
            <SunArc className="w-5 h-5" /> {verdict}
          </VerdictBadge>
        </div>

        {!profile.allYear && !profile.neverPossible && impossibleBand && (
          <p className="mt-3 text-body">
            {t("impossibleRange", {
              ...labels,
              ...verdictMonths(p.locale, impossibleBand.start - 1, impossibleBand.end - 1),
            })}
          </p>
        )}

        {dateRange && (
          <div className="mt-3">
            <div className="text-caption text-text-muted">{t("exactWindowLabel")}</div>
            <div className="text-heading">{dateRange}</div>
          </div>
        )}

        <div className="mt-4">
          <p className="text-body">{t("notifyLead", labels)}</p>
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
        </div>
      </CityHero>

      {/* Year profile + seasonal windows: side by side on desktop, stacked on mobile. */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card variant="glass">
          <h2 className="font-display text-title">{t("yearHeading", labels)}</h2>
          <div className="mt-3">
            <Card variant="window">
              <CityYearStrip
                hoursByDay={profile.hoursByDay}
                monthLabels={labelsForChart}
                caption={t("yearCaption")}
                legend={{ low: t("yearLegendLow"), high: t("yearLegendHigh") }}
              />
            </Card>
          </div>
        </Card>

        <Card variant="glass">
          <h2 className="font-display text-title">{t("seasonHeading")}</h2>
          <ul className="mt-3 space-y-1 text-body">
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
          <p className="mt-2 text-caption text-text-muted">{t("seasonNote")}</p>
        </Card>
      </div>

      {!profile.allYear && (
        <Card variant="glass" className="mt-6">
          <h2 className="font-display text-title">{t("supplementHeading", labels)}</h2>
          <p className="text-body mt-2">{t("supplementBody")}</p>
          <A href="/learn#supplement" className="text-caption mt-2 inline-block">
            {t("supplementMore")}
          </A>
        </Card>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className={ctaClasses}>
          {t("ctaLabel", labels)}
        </Link>
      </div>

      <Card variant="glass" className="mt-6">
        <h2 className="font-display text-title">{t("faqHeading", labels)}</h2>
        <dl className="mt-3 space-y-3">
          {faq.map((q) => (
            <div key={q.name}>
              <dt className="font-semibold">{q.name}</dt>
              <dd className="text-body text-text-muted">{q.acceptedAnswer.text}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Cross-links to the nearest cities: turns the 438 pages into a crawlable
          mesh and gives the reader somewhere to go. Static, so Google follows it. */}
      <nav className="mt-6">
        <Card variant="glass">
          <h2 className="font-display text-title">{t("nearbyHeading")}</h2>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body">
            {nearby.map((nb) => {
              const nbBase = baseSlug(nb.id);
              return (
                <li key={nb.id}>
                  <A href={cityPathname(p.locale, nbBase)}>{localizedCityName(p.locale, nbBase)}</A>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-body">
            <A href={indexPathname(p.locale)} className="font-semibold">
              {t("allCitiesLink")} →
            </A>
          </p>
        </Card>
      </nav>
    </main>
  );
}
