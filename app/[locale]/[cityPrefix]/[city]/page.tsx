import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CityHeroBold from "@/components/CityHeroBold";
import CityYearStrip from "@/components/CityYearStrip";
import NotificationToggle from "@/components/NotificationToggle";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
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
// Sized up for the bold variant: same colors/behavior, bigger tap target.
const ctaClasses =
  "inline-flex items-center justify-center gap-2 min-h-[56px] px-8 rounded-2xl text-heading font-bold " +
  "transition-colors bg-sun text-white hover:bg-sun-strong shadow-lg shadow-sun/20";

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

  // The hero's giant focal stat: same three-way state as `verdict` above, but
  // rendered as the compact "N months of sun" / "sun all year" / "no solar
  // synthesis" phrase already used for exactly this purpose on the index page.
  const statPhrase = profile.allYear
    ? t("indexAllYear")
    : profile.neverPossible
      ? t("indexNever")
      : t("indexMonths", { count: profile.possibleMonths.length });

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
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq }),
        }}
      />

      {/* BOLD exploratory hero: full-bleed poster-scale sky, verdict as a giant
          editorial statement rather than a small badge in a contained glass card.
          See components/CityHeroBold.tsx. */}
      <CityHeroBold
        lat={city.lat}
        lon={city.lon}
        eyebrow={localizedCityName(p.locale, base)}
        title={t("title", labels)}
        tone={!profile.neverPossible ? "possible" : "winter"}
        statPhrase={statPhrase}
        verdict={verdict}
        impossibleText={
          !profile.allYear && !profile.neverPossible && impossibleBand
            ? t("impossibleRange", {
                ...labels,
                ...verdictMonths(p.locale, impossibleBand.start - 1, impossibleBand.end - 1),
              })
            : null
        }
        exactWindowLabel={t("exactWindowLabel")}
        dateRange={dateRange}
        notifyLead={t("notifyLead", labels)}
        notify={
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
        }
      />

      {/* Year profile: the page's signature data-graphic, promoted to a full-width
          protagonist band instead of a card nested inside a card. */}
      <section className="mt-10 sm:mt-16">
        <h2 className="font-display text-2xl sm:text-4xl font-bold">{t("yearHeading", labels)}</h2>
        <p className="mt-2 text-body text-text-muted max-w-2xl">{t("yearCaption")}</p>
        <Card variant="window" className="mt-5 sm:mt-6 !p-5 sm:!p-8">
          <CityYearStrip
            hoursByDay={profile.hoursByDay}
            monthLabels={labelsForChart}
            caption={t("yearCaption")}
            legend={{ low: t("yearLegendLow"), high: t("yearLegendHigh") }}
            height={110}
          />
        </Card>
      </section>

      {/* Seasonal windows + supplement: two balanced columns (supplement drops
          when the city synthesizes all year, and then seasons runs full-width). */}
      <div className={`mt-10 sm:mt-16 grid gap-6 lg:gap-8 items-start ${profile.allYear ? "" : "lg:grid-cols-2"}`}>
        <Card variant="glass" className="!p-6 sm:!p-8">
          <h2 className="font-display text-title sm:text-2xl font-bold">{t("seasonHeading")}</h2>
          <ul className="mt-4 space-y-3 text-body sm:text-heading">
            {windows.map((w) => (
              // These lines start with the month, so it must be capitalized —
              // es/fr/ru/lt all yield a lowercase nominative from Intl.
              <li key={w.doy} className="border-b border-border-subtle pb-3 last:border-0 last:pb-0">
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
          <p className="mt-4 text-caption text-text-muted">{t("seasonNote")}</p>
        </Card>

        {!profile.allYear && (
          <Card variant="glass" className="!p-6 sm:!p-8">
            <h2 className="font-display text-title sm:text-2xl font-bold">{t("supplementHeading", labels)}</h2>
            <p className="text-body mt-3 sm:text-heading">{t("supplementBody")}</p>
            <A href="/learn#supplement" className="text-caption mt-3 inline-block">
              {t("supplementMore")}
            </A>
          </Card>
        )}
      </div>

      {/* Primary CTA — full-width, centered conversion band (the main action, so
          it stands on its own instead of being tucked into a column). */}
      <div className="mt-10 sm:mt-14 flex justify-center">
        <Link href="/dashboard" className={`${ctaClasses} w-full sm:w-auto sm:min-w-[420px]`}>
          {t("ctaLabel", labels)}
        </Link>
      </div>

      {/* FAQ — full-width, two columns on desktop. */}
      <section className="mt-10 sm:mt-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("faqHeading", labels)}</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
          {faq.map((q) => (
            <div key={q.name}>
              <dt className="font-semibold text-heading">{q.name}</dt>
              <dd className="text-body text-text-muted mt-1">{q.acceptedAnswer.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Cross-links to the nearest cities: turns the 438 pages into a crawlable
          mesh and gives the reader somewhere to go. Static, so Google follows it.
          Wide footer strip — a border-top band, not another glass card, so not
          every block on the page has an identical surface treatment. */}
      <nav className="mt-10 sm:mt-16 pt-8 sm:pt-10 border-t border-border-default">
        <h2 className="font-display text-title sm:text-2xl font-bold">{t("nearbyHeading")}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {nearby.map((nb) => {
            const nbBase = baseSlug(nb.id);
            return (
              <li key={nb.id}>
                <A
                  href={cityPathname(p.locale, nbBase)}
                  className="inline-flex min-h-[40px] items-center rounded-full border border-border-default bg-glass px-4 text-body no-underline hover:bg-surface-elevated"
                >
                  {localizedCityName(p.locale, nbBase)}
                </A>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-body">
          <A href={indexPathname(p.locale)} className="font-semibold">
            {t("allCitiesLink")} →
          </A>
        </p>
      </nav>
    </main>
  );
}
