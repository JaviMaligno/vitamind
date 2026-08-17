import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
import TodayProvider from "@/components/TodayProvider";
import TodayWindow from "@/components/TodayWindow";
import TodayFaq from "@/components/TodayFaq";
import { sunPageGraph } from "@/lib/schema";
import {
  SUNRISE_CITIES, MONTH_SLUGS, sunPathname, sunCityPathname, buildSunCityAlternates,
} from "@/lib/sun-routes";
import { baseSlug, cityPathname, localizedCityName } from "@/lib/city-routes";
import { nearbyCities } from "@/lib/city-nearby";
import { capFirst, monthName } from "@/lib/city-copy";
import { cityYearProfile, contiguousMonthRange } from "@/lib/city-content";
import { cityToday, sunTodayData, sunTodayCopy, todayWindowCopy } from "@/lib/sun-today";
import { DOY_REFERENCE_YEAR } from "@/lib/solar";
import type { City } from "@/lib/types";

/**
 * The city hub at the sunrise prefix without a month (`/amanecer/madrid`).
 *
 * It is NOT "what time is sunrise today" — that is the single data point the AI
 * Overview already answers and where our measured click-through is 0.17%. Its
 * subject is today's VITAMIN D WINDOW: the hours when clear-sky UVI reaches 3
 * (`MIN_UVI`, lib/vitd.ts), which no ephemeris rival publishes and which
 * genuinely changes through the year. The clock times are supporting data.
 *
 * Lives beside `page.tsx` rather than in its own route folder because the URL
 * shares the `[cityPrefix]/[city]` segment with the vitamin D city pages, and
 * Next allows only one dynamic segment name per position. `page.tsx` dispatches
 * on the prefix.
 *
 * The freshness design (what is server-rendered, what the browser recomputes,
 * and why no server string names a date) is documented in lib/sun-today.ts.
 */

interface Resolved {
  city: City;
  base: string;
}

/**
 * The metadata is the artefact this page exists to win — the SERP snippet and
 * what an AI Overview ingests — and it is the one surface no browser ever
 * corrects. So it states no day's figures and does not branch on regime: with
 * an unbounded ISR cache behind it, a snippet reading "no vitamin D today" for
 * a city with an eight-hour window is a live possibility, and a snippet with no
 * numbers beats one whose numbers may be a season old. Only `{city}` is
 * interpolated. See lib/sun-today.ts.
 */
export async function sunTodayMetadata(locale: string, { city, base }: Resolved): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "sunToday" });
  const alternates = buildSunCityAlternates(locale, base);
  const copy = pageCopy(locale, city, base);

  const title = t("metaTitle", copy.metaValues);
  const description = t("metaDescription", copy.metaValues);
  return {
    title,
    description,
    alternates,
    // `article` like the month pages: this is a dated statement about a place,
    // not an app screen. No `publishedTime`/`modifiedTime` — an ISR page cannot
    // honestly stamp one, which is the same reason the copy names no date.
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
}

/** One computation, shared by `generateMetadata` and the page body. */
function pageCopy(locale: string, city: City, base: string) {
  const today = cityToday(city);
  const data = sunTodayData(city, today);
  const profile = cityYearProfile(city.lat, city.lon, city.elevation ?? 0);
  const cityName = localizedCityName(locale, base);
  return {
    ...sunTodayCopy({
      locale,
      cityName,
      data,
      profile,
      band: contiguousMonthRange(profile.possibleMonths),
    }),
    today,
    data,
    cityName,
  };
}

export default async function SunTodayPage({ locale, resolved }: { locale: string; resolved: Resolved }) {
  const { city, base } = resolved;
  const t = await getTranslations({ locale, namespace: "sunToday" });
  const tSunrise = await getTranslations({ locale, namespace: "sunrisePage" });
  const tSun = await getTranslations({ locale, namespace: "sunTimes" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const copy = pageCopy(locale, city, base);
  const { cityName, data, today } = copy;

  const yearEntry = {
    q: t(copy.yearFaq.qKey, copy.yearFaq.qValues),
    a: t(copy.yearFaq.aKey, copy.yearFaq.aValues),
  };

  /**
   * ONLY the year answer is marked up.
   *
   * Structured data is handed to Google verbatim and never revisited, and this
   * HTML comes from a cache with no upper bound on its age. The window and the
   * sun times are true of one day; the year answer comes from `cityYearProfile`
   * walking all 365 days, so it is true of the PLACE and cannot go stale. The
   * other two questions stay visible to the reader (corrected in the browser by
   * `TodayFaq`) but assert nothing to a crawler. A FAQPage may mark up a subset
   * of the page's questions; it may not mark up an answer that is wrong.
   */
  const faq = [{
    "@type": "Question",
    name: yearEntry.q,
    acceptedAnswer: { "@type": "Answer", text: yearEntry.a },
  }];

  const pageTitle = t("title", { city: cityName });
  const url = buildSunCityAlternates(locale, base).canonical;

  /**
   * `sunPageGraph` stamps its Event instants with `DOY_REFERENCE_YEAR`, because
   * that is the year every table on this site is computed for. On a page whose
   * subject is today, publishing an Event dated 2026 while the reader is in 2027
   * would be a fabricated instant, so the Events are emitted only while the two
   * agree; the Place, WebPage, BreadcrumbList and FAQPage nodes are unaffected.
   *
   * WHEN `DOY_REFERENCE_YEAR` FALLS BEHIND, THIS TREE SILENTLY LOSES ITS Event
   * NODES — the alpenglow-parity signal PR1 added. Bumping the constant is the
   * fix; nothing here will shout about it.
   */
  const days =
    today.year === DOY_REFERENCE_YEAR
      ? [{ day: today.day, sunrise: data.sun.sunrise, sunset: data.sun.sunset }]
      : [];

  const graph = sunPageGraph({
    city,
    base,
    cityName,
    locale,
    monthIndex: today.monthIndex,
    url,
    pageName: pageTitle,
    labels: { sunrise: tSun("sunrise"), sunset: tSun("sunset"), cities: tNav("cities") },
    days,
    faq,
  });

  const nearby = nearbyCities(city.id)
    .filter((nb) => SUNRISE_CITIES.includes(baseSlug(nb.id)))
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <p className="text-caption font-semibold uppercase tracking-[0.2em] text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
        {pageTitle}
      </h1>

      {/* Everything on this page that depends on WHICH DAY it is sits inside
          the provider — the lede, the stat panel and the two day-dependent FAQ
          answers — so all of it is corrected by one recomputation in the
          browser. Correcting only some of it is how a panel ends up saying "no
          window today" above an answer that names one. The server-rendered
          sections in between are passed straight through as children. */}
      <TodayProvider
        city={{ lat: city.lat, lon: city.lon, tz: city.tz, timezone: city.timezone, elevation: city.elevation }}
        cityName={cityName}
        initial={todayWindowCopy(cityName, data)}
      >
        <TodayWindow />

        {/* Why a page about today has to exist at all. */}
        <section className="mt-10">
          <Card variant="glass" className="!p-6 sm:!p-8">
            <h2 className="font-display text-title sm:text-2xl font-bold">{t("changesHeading")}</h2>
            <p className="mt-3 text-body sm:text-heading text-text-secondary leading-relaxed">
              {t("changesBody", { city: cityName })}
            </p>
            <A href={cityPathname(locale, base)} className="mt-3 inline-block text-caption font-semibold">
              {tSunrise("vitdCta", { city: cityName })}
            </A>
          </Card>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            {t("faqHeading", copy.headingValues)}
          </h2>
          <TodayFaq year={yearEntry} />
        </section>
      </TodayProvider>

      {/* Internal mesh. The hub is the city's entry point into its twelve month
          pages, and each of those links back here. */}
      <nav className="mt-10 pt-8 border-t border-border-default">
        <h2 className="font-display text-title sm:text-2xl font-bold">
          {tSunrise("monthsHeading", { city: cityName })}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {MONTH_SLUGS[locale].map((slug, m) => (
            <li key={slug}>
              <A
                href={sunPathname(locale, base, m)}
                className="inline-flex min-h-[44px] items-center rounded-full border border-border-default bg-glass px-4 text-body no-underline hover:bg-surface-elevated"
              >
                {capFirst(monthName(locale, m))}
              </A>
            </li>
          ))}
        </ul>

        {nearby.length > 0 && (
          <>
            <h2 className="mt-8 font-display text-title sm:text-2xl font-bold">{tSunrise("nearbyHeading")}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nearby.map((nb) => {
                const nbBase = baseSlug(nb.id);
                return (
                  <li key={nb.id}>
                    <A
                      href={sunCityPathname(locale, nbBase)}
                      className="inline-flex min-h-[44px] items-center rounded-full border border-border-default bg-glass px-4 text-body no-underline hover:bg-surface-elevated"
                    >
                      {localizedCityName(locale, nbBase)}
                    </A>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* Every page that states a figure says where the figure comes from;
            the bibliography lives on /methodology, not repeated here. */}
        <p className="mt-6 text-caption text-text-muted">
          <A href="/methodology">{tSunrise("howCalculated")}</A>
        </p>
      </nav>
    </main>
  );
}
