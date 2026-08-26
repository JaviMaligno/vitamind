import type { Metadata } from "next";
import { authorship } from "@/lib/schema";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CityCta from "@/components/CityCta";
import CityHeroBold from "@/components/CityHeroBold";
import CityYearStrip from "@/components/CityYearStrip";
import PhaseWindow from "@/components/PhaseWindow";
import NotificationToggle from "@/components/NotificationToggle";
import SunTimesPanel from "@/components/SunTimesPanel";
import MonthlySunTable from "@/components/MonthlySunTable";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { BUILTIN_GEONAME_ID } from "@/lib/builtin-geonames";
import {
  cityYearProfile, citySeasonalWindows, contiguousMonthRange, viableDateBoundaries,
} from "@/lib/city-content";
import {
  CITY_PREFIX, baseSlug, cityIdFromSlug, localizedCityName, cityPathname, indexPathname,
} from "@/lib/city-routes";
import {
  resolveDynamicCity, dynamicCityPathname, buildDynamicCityAlternates,
} from "@/lib/city-dynamic";
import { nearbyCitiesTo } from "@/lib/city-nearby";
import { inferElevationM } from "@/lib/elevation";
import { capFirst, cityLabels, monthLabels, monthName, verdictMonths } from "@/lib/city-copy";
import { fmtTime, dateFromDoy, doyFromMonthDay } from "@/lib/solar";
import { getSunTimes, monthlySunTimes } from "@/lib/sun-times";
import type { City } from "@/lib/types";

/**
 * THE ON-DEMAND CITY PAGE — the second family answering `/{prefix}/{slug}`.
 *
 * Nobody links here by this path. Visitors ask for `/vitamina-d/toledo-es` and
 * `proxy.ts` REWRITES that to this route (`i18n/on-demand-city-rewrite.ts`
 * decides), so the public URL, the canonical and the hreflang set are exactly
 * what they would be if one file served both families. The extra static segment
 * exists only to give this file a route of its own.
 *
 * WHY IT IS A SEPARATE FILE AT ALL — measured, 2026-08-26, Next 16.1.6, real
 * `next start`, six segment-config variants (the plan's Paso 4): a `notFound()`
 * for a param the route's static-param list did not contain IS written to the
 * full route cache — `x-nextjs-prerender: 1`, `Cache-Control: s-maxage=31536000`, 11 files
 * and 19,613 bytes per junk URL, HIT on the second request. Dropping
 * `revalidate` does not stop it. `dynamicParams = false` does not stop it.
 * `await connection()` before the `notFound()` returns HTTP 500
 * (`DYNAMIC_SERVER_USAGE`), not a 404. Only `dynamic = "force-dynamic"` stops it
 * — and segment config is per FILE, so putting it in the curated file would take
 * its 438 prerendered pages out of the build. With ~235,000 rows behind this
 * route and an ISR write quota that closed the last 30-day window at 181%
 * (362,730 of 200,000), an uncacheable miss is the whole point of the split.
 *
 * WHY THE RENDER IS A SIBLING COPY OF THE CURATED PAGE'S, and not a shared
 * component. It very nearly is one, and the difference is four values: the
 * display name, the elevation, how the nearby cities are chosen, and the
 * provenance line. Extracting the body is blocked by three guards that are
 * anchored, on purpose, to the curated route file's PATH:
 * `lib/__tests__/content-revision.test.ts` greps that file for its
 * `getTranslations` namespaces and requires exactly `cityPage` + `sunTimes`;
 * `app/__tests__/jsonld-authorship.test.ts` requires the JSON-LD and
 * `authorship()` to be in it; `app/__tests__/sun-hub-split.test.ts` scans it (and
 * a fixed list of lib modules) for clock reads, which is what keeps
 * `revalidate = false` honest over there. Moving the body would need all three
 * edited in the same commit as the split itself. That is a refactor with its own
 * risk budget, not a line item inside this one — it is written up as declared
 * debt in the PR body. Anything that changes what a city page PRINTS has to be
 * changed in both files until then.
 *
 * FOUR LOCKS KEEP THIS FAMILY OUT OF THE INDEX (D-15): `robots: index: false`
 * below, absence from `app/sitemap.ts`, absence from the IndexNow payload, and
 * no dynamic-to-dynamic cross-links — every outbound link from here lands on a
 * curated page or on the index.
 */

/**
 * NOT prerendered, and never cached. See the header: this is the only measured
 * defence against an outsider driving unbounded ISR writes by requesting junk.
 * The syntactic prefilter in `resolveDynamicCity` saves the DATABASE round trip,
 * not the cache write — its reject branch also ends in `notFound()`.
 */
export const dynamic = "force-dynamic";

type Params = { locale: string; cityPrefix: string; city: string };

type Resolved =
  | { kind: "dynamic"; city: City; slug: string; nameIsLocalized: boolean }
  | { kind: "redirect"; to: string };

/**
 * Resolves (locale, prefix, slug) → an on-demand city, a permanent redirect, or
 * null when the route is bogus.
 *
 * ONE CITY, ONE URL. Two forms have to be sent somewhere else rather than
 * served: the qualified form of a CURATED city (`/vitamina-d/shanghai-cn`, which
 * would otherwise be a second Shanghai page competing with the real one), and
 * the `id-{geonameid}` alias the search chip emits, which 301s to the canonical
 * slug. `lib/builtin-geonames.ts` is what makes the first one decidable: it
 * cannot be derived from the slug (the names differ per locale) nor from the
 * coordinates (Getafe is 15 km from Madrid and is not Madrid).
 */
async function resolveOnDemandCity({ locale, cityPrefix, city }: Params): Promise<Resolved | null> {
  // Still load-bearing even though the rewrite already checked it: this route is
  // reachable by its own path, and a wrong-locale prefix must 404 here too.
  if (cityPrefix !== CITY_PREFIX[locale]) return null;

  // The curated namespace wins (D-12). The rewrite never sends one here; if it
  // ever did, serving it would be duplicate content pointing away from itself.
  if (cityIdFromSlug(locale, city)) return null;

  const hit = await resolveDynamicCity(locale, city);
  if (!hit) return null;

  const curatedBase = Object.entries(BUILTIN_GEONAME_ID)
    .find(([, id]) => `geonames:${id}` === hit.city.id)?.[0];
  if (curatedBase) return { kind: "redirect", to: cityPathname(locale, curatedBase) };
  if (hit.canonicalSlug !== city) {
    return { kind: "redirect", to: dynamicCityPathname(locale, hit.canonicalSlug) };
  }

  return {
    kind: "dynamic",
    city: hit.city,
    slug: hit.canonicalSlug,
    nameIsLocalized: hit.nameIsLocalized,
  };
}

/** The locale-local target of a redirect, as the absolute path to send. */
function absolute(locale: string, href: string): string {
  return getPathname({ href, locale: locale as (typeof routing.locales)[number] });
}

/**
 * The ground elevation this page states its numbers were computed from.
 *
 * GeoNames has no `dem` for 0.2% of rows (437 of 235,503) and the seed stores
 * that as NULL rather than as a claim about sea level, so a fallback is needed.
 * `inferElevationM` borrows the altitude of a curated city within 25 km, which
 * is a real fact about the same place; beyond that it declines, and 0 is the
 * same assumption every non-curated city on this site already carries.
 */
function elevationFor(city: City): number {
  return city.elevation ?? inferElevationM(city.lat, city.lon) ?? 0;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const r = await resolveOnDemandCity(p);
  // A redirect has no metadata of its own; the page body issues it.
  if (!r || r.kind === "redirect") return {};

  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  // next-intl's untyped `t` wants Record<string, ...>; CityLabels is an interface
  // (no implicit index signature), so widen via a fresh literal. Values unchanged.
  // The name is the RPC's `display_name`, never the slug.
  const labels: Record<string, string> = { ...cityLabels(p.locale, r.city.name) };
  const alternates = buildDynamicCityAlternates(p.locale, r.slug);

  const title = t("title", labels);
  const description = t("metaDescription", labels);

  return {
    title,
    description,
    // Self-referencing, never canonical to the nearest curated city: canonical
    // means "this is the same page", and Toledo is not Madrid.
    alternates,
    // D-15, the central lock: 1.38M thin URLs must not ask for a place in the
    // index. `follow` so the outbound links to the index and to the curated
    // cities keep passing.
    robots: { index: false, follow: true },
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
}

export default async function OnDemandCityPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const r = await resolveOnDemandCity(p);
  if (!r) notFound();
  if (r.kind === "redirect") permanentRedirect(absolute(p.locale, r.to));
  setRequestLocale(p.locale);

  const city = r.city;
  const displayName = city.name;
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  const tSun = await getTranslations({ locale: p.locale, namespace: "sunTimes" });

  // Every value a cityPage template may reference. Each locale uses the subset it
  // needs — ICU ignores extras but throws on a missing one, so pass the superset.
  const labels: Record<string, string> = { ...cityLabels(p.locale, displayName) };

  // The synthesis threshold depends on ozone (latitude, longitude, season) and on
  // altitude, so the city's real position and elevation must both be passed. This
  // is the claim `cityPage.dynamicProvenance` prints at the bottom of the page.
  const elevationM = elevationFor(city);
  const profile = cityYearProfile(city.lat, city.lon, elevationM);
  const windows = citySeasonalWindows(city.lat, city.lon, city.tz, elevationM);
  const labelsForChart = monthLabels(p.locale);

  const bounds =
    profile.allYear || profile.neverPossible ? null : viableDateBoundaries(profile.hoursByDay);
  const dateRange = bounds
    ? new Intl.DateTimeFormat(p.locale, { day: "numeric", month: "long", timeZone: "UTC" })
        .formatRange(dateFromDoy(bounds.startDoy), dateFromDoy(bounds.endDoy))
    : null;

  // Circular band: southern-hemisphere cities wrap around January.
  const possibleBand = contiguousMonthRange(profile.possibleMonths);
  const impossibleBand = contiguousMonthRange(profile.impossibleMonths);

  // By COORDINATE, and always over the curated set. An on-demand city has no
  // entry in BUILTIN_CITIES to look up, and a dynamic-to-dynamic mesh would be a
  // crawlable path into 1.38M `noindex` URLs.
  const nearby = nearbyCitiesTo(city.lat, city.lon, 5);

  const verdict = profile.allYear
    ? t("verdictAllYear", labels)
    : profile.neverPossible
      ? t("verdictNever", labels)
      : t("verdictRange", {
          ...labels,
          ...verdictMonths(p.locale, possibleBand!.start - 1, possibleBand!.end - 1),
        });

  const statPhrase = profile.allYear
    ? t("indexAllYear")
    : profile.neverPossible
      ? t("indexNever")
      : t("indexMonths", { count: profile.possibleMonths.length });

  const summerWindow = windows.find((w) => w.possible && w.minutesNeeded !== null);

  // Month-by-month sun values feed both the static table below and the sun FAQs.
  const monthly = monthlySunTimes(city.lat, city.lon, city.timezone, city.tz);
  const june = monthly[5];
  const dec = monthly[11];
  const longest = monthly.reduce((a, b) => (b.dayLengthMin > a.dayLengthMin ? b : a));
  const shortest = monthly.reduce((a, b) => (b.dayLengthMin < a.dayLengthMin ? b : a));
  // Through `dateFromDoy`, like every other table on this site: a host-local
  // `new Date(2026, 5, 15)` is a different INSTANT on every machine.
  const goldenOn = (monthIndex: number, day: number) =>
    getSunTimes(city.lat, city.lon, dateFromDoy(doyFromMonthDay(monthIndex, day)), city.timezone, city.tz)
      .goldenEveningStart;
  const juneGolden = goldenOn(5, 15);
  const decGolden = goldenOn(11, 15);

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
    ...(june.sunrise !== null && june.sunset !== null && dec.sunrise !== null && dec.sunset !== null
      ? [{
          "@type": "Question",
          name: tSun("faqTimesQ", labels),
          acceptedAnswer: {
            "@type": "Answer",
            text: tSun("faqTimesA", {
              juneSunrise: fmtTime(june.sunrise),
              juneSunset: fmtTime(june.sunset),
              decSunrise: fmtTime(dec.sunrise),
              decSunset: fmtTime(dec.sunset),
            }),
          },
        }]
      : []),
    {
      "@type": "Question",
      name: tSun("faqLongestQ", labels),
      acceptedAnswer: {
        "@type": "Answer",
        text: tSun("faqLongestA", {
          maxMonth: monthName(p.locale, longest.monthIndex),
          maxHours: Math.round(longest.dayLengthMin / 60),
          minMonth: monthName(p.locale, shortest.monthIndex),
          minHours: Math.round(shortest.dayLengthMin / 60),
        }),
      },
    },
    ...(juneGolden !== null && decGolden !== null
      ? [{
          "@type": "Question",
          name: tSun("faqGoldenQ", labels),
          acceptedAnswer: {
            "@type": "Answer",
            text: tSun("faqGoldenA", { juneGolden: fmtTime(juneGolden), decGolden: fmtTime(decGolden) }),
          },
        }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq, ...authorship() }),
        }}
      />

      <CityHeroBold
        lat={city.lat}
        lon={city.lon}
        eyebrow={displayName}
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
            cityName={displayName}
            labelOff={t("notifyOff")}
            labelOn={t("notifyOn")}
            prominent
            onDark
          />
        }
      />

      {/* Today's sun: sunrise, sunset, golden hour and day length, computed
          client-side so the page never shows a stale "today". */}
      <section className="mt-10 sm:mt-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{tSun("cityHeading", labels)}</h2>
        <p className="mt-2 text-body text-text-muted max-w-2xl">{tSun("cityCaption")}</p>
        <div className="mt-5">
          <SunTimesPanel lat={city.lat} lon={city.lon} tz={city.tz} timezone={city.timezone} />
        </div>
      </section>

      {/* Year profile: the page's signature data-graphic. */}
      <section className="mt-10 sm:mt-16">
        <h2 className="font-display text-2xl sm:text-4xl font-bold">{t("yearHeading", labels)}</h2>
        <p className="mt-2 text-body text-text-muted max-w-2xl">{t("yearCaption")}</p>
        <PhaseWindow lat={city.lat} lon={city.lon} className="mt-5 p-5 sm:mt-6 sm:p-8">
          <CityYearStrip
            hoursByDay={profile.hoursByDay}
            monthLabels={labelsForChart}
            caption={t("yearCaption")}
            legend={{ low: t("yearLegendLow"), high: t("yearLegendHigh") }}
            height={110}
          />
        </PhaseWindow>
      </section>

      {/* Seasonal windows + supplement. */}
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

      {/* Month-by-month sunrise/sunset: fixed reference year, mid-month. */}
      <section className="mt-10 sm:mt-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{tSun("monthlyHeading", labels)}</h2>
        <p className="mt-2 text-body text-text-muted max-w-2xl">{tSun("monthlyCaption")}</p>
        <div className="mt-5">
          <MonthlySunTable
            monthly={monthly}
            monthNames={monthly.map((m) => capFirst(monthName(p.locale, m.monthIndex)))}
            lat={city.lat}
            lon={city.lon}
            tz={city.tz}
            timezone={city.timezone}
            labels={{
              month: tSun("month"),
              sunrise: tSun("sunrise"),
              sunset: tSun("sunset"),
              dayLength: tSun("dayLength"),
              day: tSun("day"),
              dawn: tSun("dawn"),
              dusk: tSun("dusk"),
              dayByDay: tSun("dayByDay"),
              twilightNote: tSun("twilightNote"),
            }}
          />
        </div>
        <p className="mt-3 text-caption text-text-muted">{tSun("monthlyNote")}</p>
      </section>

      {/* Primary CTA. */}
      <div className="mt-10 sm:mt-14 flex justify-center">
        <CityCta lat={city.lat} lon={city.lon} href="/dashboard" label={t("ctaLabel", labels)} />
      </div>

      {/* FAQ. */}
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
        <p className="mt-6 text-body">
          <A href="/learn#block-4" className="font-semibold">
            {tSun("faqMore")}
          </A>
        </p>
      </section>

      {/* Cross-links OUT of the on-demand layer: the nearest curated cities, by
          coordinate, plus the index. Never to another on-demand page — that mesh
          is the crawlable path into 1.38M noindex URLs that D-15 closes. */}
      <nav className="mt-10 sm:mt-16 pt-8 sm:pt-10 border-t border-border-default">
        <h2 className="font-display text-title sm:text-2xl font-bold">{t("nearbyHeading")}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {nearby.map((nb) => {
            const nbBase = baseSlug(nb.id);
            return (
              <li key={nb.id}>
                <A
                  href={cityPathname(p.locale, nbBase)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-border-default bg-glass px-4 text-body no-underline hover:bg-surface-elevated"
                >
                  {localizedCityName(p.locale, nbBase)}
                </A>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-body">
          <A href={indexPathname(p.locale)} className="font-semibold">
            {t("allCitiesLink")}
          </A>
        </p>

        {/* WHERE THIS PAGE CAME FROM. It is not one of the 73 curated cities, and
            saying so is the honest version of a page that otherwise looks
            identical to one. The second sentence appears only where `city_names`
            had no entry for this locale: coverage is 17.8% in ru and 2.3% in lt,
            so most Lithuanian and Russian pages print the Latin endonym inside a
            Lithuanian or Cyrillic text, and the reader is told why (Q-B(a)). */}
        <p className="mt-4 text-caption text-text-muted">
          {t("dynamicProvenance", { ...labels, city: displayName })}
          {!r.nameIsLocalized && ` ${t("dynamicNameLatin")}`}
        </p>

        <p className="mt-6 text-caption text-text-muted">
          <A href="/methodology">{t("howCalculated")}</A>
        </p>
      </nav>
    </main>
  );
}
