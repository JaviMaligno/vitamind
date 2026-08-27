import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
import TodayProvider from "@/components/TodayProvider";
import TodayWindow from "@/components/TodayWindow";
import TodayFaq from "@/components/TodayFaq";
import NotificationToggle from "@/components/NotificationToggle";
import { sunPageGraph } from "@/lib/schema";
import {
  SUNRISE_CITIES, MONTH_SLUGS, sunPathname, sunCityPathname, buildSunCityAlternates,
} from "@/lib/sun-routes";
import { baseSlug, cityPathname, localizedCityName } from "@/lib/city-routes";
import { nearbyCities } from "@/lib/city-nearby";
import { capFirst, monthName } from "@/lib/city-copy";
import { cityYearProfile, contiguousMonthRange } from "@/lib/city-content";
import { cityToday, sunTodayData, sunTodayCopy, todayWindowCopy, todayEventDays } from "@/lib/sun-today";
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
 * Lives in this private (`_`-prefixed, so unroutable) folder because it is
 * rendered from SIX route files — `app/[locale]/amanecer/[city]/page.tsx` and
 * one sibling per locale prefix — wired up by `hub-route.tsx` next to it. It
 * used to sit beside the vitamin D city page and be dispatched from it on the
 * prefix; `hub-route.tsx` records why that changed.
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
  // Reused verbatim from the city page rather than given keys of its own: the
  // ask is the same ask, the strings already exist in all six locales, and a
  // new `sunToday` key would move the month pages' content fingerprint (that
  // namespace is hashed there) for copy those pages never print.
  const tCity = await getTranslations({ locale, namespace: "cityPage" });

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
   * The Events are the ONE server-rendered surface on this page that names a
   * calendar date, and that is deliberate: they are what makes a hub's freshness
   * machine-readable, which is what `/api/revalidate-today` reads back to prove
   * its own run did something. The decision about which day (and when there is
   * no day at all) lives in `todayEventDays` — see defence #4 in lib/sun-today.ts.
   */
  const days = todayEventDays(today, data.sun);

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

      {/*
        THE ONE WAY BACK.

        99 of this site's 101 monthly clicks land on this family, and until now
        it was the only family with no way to be reminded to return: a visitor
        read today's window and left, and nothing ever brought them back. The
        toggle already existed on the city page, the dashboard and the profile —
        pages this traffic does not visit.

        Three deliberate constraints, because this page's job is unchanged:

        - It sits BELOW the window, in one block. Nothing above the fold moves,
          there is no overlay and no interstitial. A reader who wants the hour
          gets the hour.
        - It is OUTSIDE `TodayProvider`. The provider exists so that every
          day-dependent surface is corrected by ONE recomputation; a permission
          toggle is not day-dependent and has no business in that state.
        - It is invisible to `generateMetadata` and to `sunPageGraph`. What is
          promised to a crawler is exactly what it was before this block existed.

        The month pages get nothing: 2880 pages of table whose natural way back
        is the link to this hub, and the downside of disturbing the family that
        works outweighs the upside.
      */}
      <section className="mt-10">
        <Card variant="glass" className="!p-6 sm:!p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-[46ch] text-body sm:text-heading text-text-secondary leading-relaxed">
              {tCity("notifyLead", { city: cityName })}
            </p>
            <NotificationToggle
              lat={city.lat}
              lon={city.lon}
              tz={city.tz}
              timezone={city.timezone}
              skinType={3}
              areaFraction={0.25}
              cityName={cityName}
              labelOff={tCity("notifyOff")}
              labelOn={tCity("notifyOn")}
              prominent
            />
          </div>
        </Card>
      </section>

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
