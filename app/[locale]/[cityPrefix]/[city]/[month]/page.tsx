import type { Metadata } from "next";
import { sunPageGraph } from "@/lib/schema";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
import PhaseWindow from "@/components/PhaseWindow";
import {
  SUNRISE_CITIES, MONTH_SLUGS, resolveSunPage, sunPathname, sunCityPathname, sunStaticParams,
  buildSunAlternates,
} from "@/lib/sun-routes";
import { baseSlug, cityPathname, localizedCityName } from "@/lib/city-routes";
import { nearbyCities } from "@/lib/city-nearby";
import { capFirst, monthName } from "@/lib/city-copy";
import { fmtTime, fmtDayLength, DOY_REFERENCE_YEAR, sunDirection, doyFromMonthDay } from "@/lib/solar";
import { compassPoint } from "@/lib/compass";
import { monthData, sunPageCopy } from "@/lib/sun-copy";
import { sunProse } from "@/lib/sun-prose";
import { isTreated } from "@/lib/phase2-cities";

/**
 * Programmatic SEO page: sunrise/sunset for one city and one month
 * (`/amanecer/madrid/julio`), fully static. The day-by-day detail is
 * server-rendered here — unlike the city pages' expandable table — because on
 * these pages it IS the content being searched for. Values use the fixed
 * reference year (astronomically ±1-2 min across years; the copy says so).
 */

export function generateStaticParams() {
  return sunStaticParams();
}

/**
 * Static. This render is a pure function of (city, month, DOY_REFERENCE_YEAR),
 * so build time is the only time it needs.
 *
 * It used to be `86400`, on the argument that "the served HTML carrying a
 * current date is the difference between a page that reads as this year's and
 * one that reads as an archive". That argument was wrong about this page: the
 * HTML carries no current date. Nothing on the render path reads a clock —
 * every date is built as `new Date(Date.UTC(DOY_REFERENCE_YEAR, ...))`, the
 * year the page prints is the hardcoded constant at lib/solar.ts, and the only
 * dates in the built artifact are the JSON-LD Event bounds of the month being
 * rendered. Regenerating this page in 2027 would still print 2026, so an
 * interval could never buy the freshness it was charged for. What moves these
 * pages into a new year is bumping DOY_REFERENCE_YEAR, which is a deploy.
 *
 * The interval was not free. It put all 2880 of these pages in the ISR cache
 * class, which is billed per read and per write in 8 KB units, and they are by
 * far the largest page group on the site — see "Vercel plan and usage limits"
 * in CLAUDE.md. `false` returns them to the static class, which the meters
 * showed costing nothing for the weeks before the interval was introduced.
 *
 * The interval arrived coupled to the phase-2 prose A/B (it was added in the
 * same commit), but the coupling is spurious: lib/phase2-cities.ts reads a
 * static assignment file with no date logic, so the experiment never needed
 * daily regeneration.
 */
export const revalidate = false;

type Params = { locale: string; cityPrefix: string; city: string; month: string };

const t2 = (h: number | null) => (h !== null ? fmtTime(h) : "—");

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const resolved = resolveSunPage(p.locale, p.cityPrefix, p.city, p.month);
  if (!resolved) return {};
  const t = await getTranslations({ locale: p.locale, namespace: "sunrisePage" });
  const tCompass = await getTranslations({ locale: p.locale, namespace: "compass" });
  const alternates = buildSunAlternates(p.locale, resolved.base, resolved.monthIndex);

  /**
   * The title and description are regime-dependent — a page whose answer is
   * "no synthesis this month" must not promise vitamin D in the SERP — so the
   * metadata needs the same figures the body renders. `monthData` is the page's
   * own helper, called with the page's own arguments: the alternative is a
   * second computation that can drift from what the reader then sees.
   */
  const { city } = resolved;
  const copy = sunPageCopy({
    cityName: localizedCityName(p.locale, resolved.base),
    month: monthName(p.locale, resolved.monthIndex),
    data: monthData(city.lat, city.lon, city.tz, city.timezone, city.elevation ?? 0, resolved.monthIndex),
    // Metadata reads only the title and description variants, but the FAQ is
    // built either way, so the resolver is supplied rather than made optional.
    compassIn: (point) => tCompass(`in.${point}`),
  });
  const title = t(copy.metaTitleKey, copy.metaValues);
  const description = t(copy.metaDescriptionKey, copy.metaValues);
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      type: "article",
      /**
       * Stated explicitly, because the one Next infers is a redirect.
       *
       * It builds the image URL from the locale segment — /es/amanecer/... —
       * but Spanish is the default locale and `proxy.ts` strips that prefix, so
       * the tag Next emits answers 307 and only the unprefixed path answers 200.
       * Plenty of social crawlers do not follow redirects for images, which
       * would lose the card in the locale that carries the most traffic.
       *
       * The canonical already carries the right shape per locale (no prefix for
       * es, /en for English), so deriving from it is correct everywhere.
       */
      images: [{ url: `${alternates.canonical}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function SunriseMonthPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const resolved = resolveSunPage(p.locale, p.cityPrefix, p.city, p.month);
  if (!resolved) notFound();
  setRequestLocale(p.locale);

  const { city, base, monthIndex } = resolved;
  const t = await getTranslations({ locale: p.locale, namespace: "sunrisePage" });
  const tSun = await getTranslations({ locale: p.locale, namespace: "sunTimes" });
  const tNav = await getTranslations({ locale: p.locale, namespace: "nav" });
  const tToday = await getTranslations({ locale: p.locale, namespace: "sunToday" });
  const tCompass = await getTranslations({ locale: p.locale, namespace: "compass" });

  const cityName = localizedCityName(p.locale, base);
  const month = monthName(p.locale, monthIndex);
  const data = monthData(city.lat, city.lon, city.tz, city.timezone, city.elevation ?? 0, monthIndex);
  const { days, first, last, deltaMin, mid, exposure, dayLen, direction } = data;
  const copy = sunPageCopy({ cityName, month, data, compassIn: (point) => tCompass(`in.${point}`) });

  /**
   * Phase 2 ships the extractable passage to half the sunrise cities; the other
   * half is the control group and must render exactly what it rendered before,
   * or the comparison answers nothing. `isTreated` is the only gate — there is
   * deliberately no query param or env override to peek with.
   */
  const prose = isTreated(base) ? sunProse(city, monthIndex) : null;

  const intro = t("intro", {
    city: cityName,
    month,
    firstSunrise: t2(first.sunrise),
    firstSunset: t2(first.sunset),
    lastDay: days.length,
    lastSunrise: t2(last.sunrise),
    lastSunset: t2(last.sunset),
    trend: deltaMin > 3 ? "longer" : deltaMin < -3 ? "shorter" : "other",
    minutes: Math.abs(deltaMin),
  });

  const midLen = dayLen(mid) !== null ? fmtDayLength(dayLen(mid)!) : "—";

  /**
   * Every figure the direction copy states comes from `monthDirection` in
   * `lib/sun-copy.ts`, which reads `sunDirection` in `lib/solar.ts` — bearings
   * clockwise from TRUE north, which is why the sentences say so rather than
   * "on the compass": a phone compass points at magnetic north.
   *
   * The same object feeds the visible paragraph and the FAQ answer that
   * `sunPageCopy` built, so the two cannot state different numbers.
   */
  const directionValues = direction && {
    city: cityName,
    month,
    sunrisePoint: tCompass(`in.${direction.sunrisePoint}`),
    sunsetPoint: tCompass(`in.${direction.sunsetPoint}`),
    sunriseBearing: direction.sunriseBearing,
    sunsetBearing: direction.sunsetBearing,
    offDegrees: direction.offDegrees,
    offSide: direction.offSide,
    driftDegrees: direction.driftDegrees,
    drift: direction.drift,
  };

  /**
   * One list, rendered twice: as the visible <section> below and as the
   * FAQPage markup inside the graph. Google requires the answers it marks up to
   * be on the page — the previous FAQ was JSON-LD only, which is why Search
   * Appearance reported no data for it — and building both from the same
   * strings is what keeps them from drifting apart.
   */
  const faqEntries = copy.faq.map((entry) => ({
    q: t(entry.qKey, entry.qValues),
    a: t(entry.aKey, entry.aValues),
  }));

  const faq = faqEntries.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  }));

  const nearby = nearbyCities(city.id)
    .filter((nb) => SUNRISE_CITIES.includes(baseSlug(nb.id)))
    .slice(0, 5);

  const pageTitle = t("title", { city: cityName, month });

  /**
   * The structured counterpart of what the page states above. It is built from
   * the same `first`/`last` objects the intro renders, not from a second
   * computation and not by parsing the formatted strings — `fmtTime` rounds the
   * minute without carrying ("20:60"), which a startDate cannot survive.
   *
   * The labels are the ones already on screen, so the graph adds no copy of its
   * own and cannot drift from the visible text.
   */
  /**
   * The Event `description`. Google lists it among the fields it wants on an
   * Event, and unlike `performer`, `organizer` or `offers` it can be filled
   * without inventing a semantics a sunrise does not have.
   *
   * It states the compass point and not the bearing: `sunDirection` is exact,
   * but the `declination()` feeding it is a one-term approximation reaching
   * 2.33 degrees of error at the latitudes we ship. The visible page prints
   * degrees next to a note saying so; a description field has nowhere to put
   * that note. The eight-point sector is 45 degrees wide and absorbs it.
   *
   * Computed per day from that day's own doy, not from the mid-month figure the
   * visible section uses — these describe the first and last of the month.
   */
  const describeDirection = (d: { day: number; sunrise: number | null; sunset: number | null }) => {
    const dir = sunDirection(city.lat, doyFromMonthDay(monthIndex, d.day));
    if (!dir) return d;
    const at = (bearing: number) => tCompass(`in.${compassPoint(bearing)}`);
    return {
      ...d,
      sunriseDescription: t("eventDescriptionSunrise", { city: cityName, point: at(dir.sunriseBearing) }),
      sunsetDescription: t("eventDescriptionSunset", { city: cityName, point: at(dir.sunsetBearing) }),
    };
  };

  const graph = sunPageGraph({
    city,
    base,
    cityName,
    locale: p.locale,
    monthIndex,
    url: buildSunAlternates(p.locale, base, monthIndex).canonical,
    pageName: pageTitle,
    labels: { sunrise: tSun("sunrise"), sunset: tSun("sunset"), cities: tNav("cities") },
    credits: { organizer: t("eventOrganizer"), performer: t("eventPerformer") },
    days: [first, last].map(describeDirection),
    faq,
  });

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
      <p className="mt-4 text-body sm:text-heading text-text-secondary max-w-2xl leading-relaxed">{intro}</p>

      {/* The extractable passage: every figure computed above, at render time. */}
      {prose && (
        <p className="mt-4 text-body text-text-secondary leading-relaxed">
          {t(
            prose.regime === "synthesis" ? "proseSynthesis"
            : prose.regime === "none" ? "proseNone"
            : "prosePolar",
            {
              city: cityName,
              month,
              year: DOY_REFERENCE_YEAR,
              lat: prose.lat.toFixed(1),
              days: prose.days,
              firstSunrise: t2(prose.firstSunrise),
              firstSunset: t2(prose.firstSunset),
              lastSunrise: t2(prose.lastSunrise),
              lastSunset: t2(prose.lastSunset),
              dayLength: prose.midDayLengthMin !== null ? fmtDayLength(prose.midDayLengthMin) : "—",
              peak: Math.round(prose.peakElevationDeg),
              windowStart: prose.vitD ? t2(prose.vitD.windowStart) : "",
              windowEnd: prose.vitD ? t2(prose.vitD.windowEnd) : "",
              minutes: prose.vitD ? prose.vitD.minutesNeeded : 0,
            },
          )}
        </p>
      )}

      {/* Mid-month snapshot */}
      <PhaseWindow lat={city.lat} lon={city.lon} className="mt-8 p-5 sm:p-6 text-on-window">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{tSun("sunrise")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold">{t2(mid.sunrise)}</span>
          </div>
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{tSun("sunset")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold">{t2(mid.sunset)}</span>
          </div>
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{tSun("goldenHour")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold whitespace-nowrap">
              {mid.goldenEveningStart !== null && mid.sunset !== null
                ? `${fmtTime(mid.goldenEveningStart)}–${fmtTime(mid.sunset)}`
                : "—"}
            </span>
          </div>
          <div>
            <span className="block text-caption uppercase tracking-wider opacity-70">{tSun("dayLength")}</span>
            <span className="mt-1 block font-mono text-xl font-semibold whitespace-nowrap">{midLen}</span>
          </div>
        </div>
      </PhaseWindow>

      {/*
        WHERE, right after WHEN. Search Console over 28 days puts direction
        queries at 9.1% CTR against 0.17% for the clock-time queries this tree is
        otherwise full of, and nothing on the site could answer them until now.
        It sits above the table because that is the order the question comes in —
        the sun rises at 07:26, and it rises over there.

        Nothing renders on a polar month: `monthDirection` returns null when any
        day of the month has no sunrise, so there is no one direction to name,
        and the FAQ drops its direction entry for the same reason.
      */}
      {direction && directionValues && (
        <section className="mt-8">
          <Card variant="glass" className="!p-6 sm:!p-8">
            <h2 className="font-display text-title sm:text-2xl font-bold">
              {t("directionHeading", { city: cityName, month })}
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <span className="block text-caption uppercase tracking-wider text-text-muted">
                  {t("directionRiseLabel")}
                </span>
                <span className="mt-1 block font-display text-xl font-semibold text-text-primary">
                  {capFirst(tCompass(`name.${direction.sunrisePoint}`))}
                </span>
                <span className="mt-0.5 block font-mono text-caption text-text-muted">
                  {direction.sunriseBearing}°
                </span>
              </div>
              <div>
                <span className="block text-caption uppercase tracking-wider text-text-muted">
                  {t("directionSetLabel")}
                </span>
                <span className="mt-1 block font-display text-xl font-semibold text-text-primary">
                  {capFirst(tCompass(`name.${direction.sunsetPoint}`))}
                </span>
                <span className="mt-0.5 block font-mono text-caption text-text-muted">
                  {direction.sunsetBearing}°
                </span>
              </div>
            </div>
            <p className="mt-5 text-body text-text-secondary leading-relaxed">
              {t("directionBody", directionValues)}
            </p>
            {/* The bearings are whole degrees off a model `lib/solar.ts`
                documents as good to ~1-2°, and they are TRUE north while the
                compass in the reader's hand is magnetic. Both belong next to
                the figure, not in a methodology page they will not open. */}
            <p className="mt-3 text-caption text-text-muted">{t("directionNote")}</p>
          </Card>
        </section>
      )}

      {/* Day-by-day table — the content these pages exist for, so it ships in HTML. */}
      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("tableHeading")}</h2>
        <p className="mt-2 text-caption text-text-muted">{t("tableCaption", { city: cityName })}</p>
        <Card variant="glass" className="mt-4 !p-0 overflow-x-auto">
          <table className="w-full text-caption sm:text-body">
            <thead>
              <tr className="text-left text-caption uppercase tracking-wider text-text-muted">
                <th className="px-2 py-2.5 sm:px-4 font-medium">{tSun("day")}</th>
                <th className="px-2 py-2.5 sm:px-4 font-medium">{tSun("dawn")}</th>
                <th className="px-2 py-2.5 sm:px-4 font-medium">{tSun("sunrise")}</th>
                <th className="px-2 py-2.5 sm:px-4 font-medium">{tSun("sunset")}</th>
                <th className="px-2 py-2.5 sm:px-4 font-medium">{tSun("dusk")}</th>
                <th className="px-2 py-2.5 sm:px-4 font-medium">{tSun("dayLength")}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const len = dayLen(d);
                return (
                  <tr key={d.day} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 sm:px-4 font-medium">{d.day}</td>
                    <td className="px-2 py-1.5 sm:px-4 font-mono text-text-muted">{t2(d.civilDawn)}</td>
                    <td className="px-2 py-1.5 sm:px-4 font-mono">{t2(d.sunrise)}</td>
                    <td className="px-2 py-1.5 sm:px-4 font-mono">{t2(d.sunset)}</td>
                    <td className="px-2 py-1.5 sm:px-4 font-mono text-text-muted">{t2(d.civilDusk)}</td>
                    <td className="px-2 py-1.5 sm:px-4 whitespace-nowrap">{len !== null ? fmtDayLength(len) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-caption text-text-muted">{t("note")}</p>
      </section>

      {/* The differentiator no ephemeris site has: the vitamin D angle. */}
      <section className="mt-10">
        <Card variant="glass" className="!p-6 sm:!p-8">
          <h2 className="font-display text-title sm:text-2xl font-bold">{t("vitdHeading", { month })}</h2>
          <p className="mt-3 text-body sm:text-heading text-text-secondary">
            {exposure
              ? t("vitdPossible", {
                  city: cityName, month,
                  start: fmtTime(exposure.windowStart), end: fmtTime(exposure.windowEnd),
                  minutes: Math.round(exposure.minutesNeeded),
                })
              : t("vitdImpossible", { city: cityName, month })}
          </p>
          <A href={cityPathname(p.locale, base)} className="mt-3 inline-block text-caption font-semibold">
            {t("vitdCta", { city: cityName })}
          </A>
        </Card>
      </section>

      {/* The same questions the FAQPage markup carries, visible to the reader. */}
      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">
          {t("faqHeading", copy.headingValues)}
        </h2>
        <dl className="mt-4 space-y-4">
          {faqEntries.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-display text-title font-semibold text-text-primary">{q}</dt>
              <dd className="mt-1 text-body text-text-secondary leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Internal mesh: all 12 months + same month nearby. */}
      <nav className="mt-10 pt-8 border-t border-border-default">
        <h2 className="font-display text-title sm:text-2xl font-bold">{t("monthsHeading", { city: cityName })}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {MONTH_SLUGS[p.locale].map((slug, m) =>
            m === monthIndex ? (
              <li key={slug} className="inline-flex min-h-[40px] items-center rounded-full bg-amber-400/20 px-4 text-body font-semibold text-text-primary">
                {capFirst(monthName(p.locale, m))}
              </li>
            ) : (
              <li key={slug}>
                <A
                  href={sunPathname(p.locale, base, m)}
                  className="inline-flex min-h-[40px] items-center rounded-full border border-border-default bg-glass px-4 text-body no-underline hover:bg-surface-elevated"
                >
                  {capFirst(monthName(p.locale, m))}
                </A>
              </li>
            ),
          )}
        </ul>

        {/* Up to the city hub. The twelve month pages and the hub link both
            ways: the hub is where this city's tree starts, and it answers the
            question a monthly table cannot — what today looks like. */}
        <p className="mt-4 text-body">
          <A href={sunCityPathname(p.locale, base)} className="font-semibold">
            {tToday("hubLink", { city: cityName })}
          </A>
        </p>

        {nearby.length > 0 && (
          <>
            <h2 className="mt-8 font-display text-title sm:text-2xl font-bold">{t("nearbyHeading")}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nearby.map((nb) => {
                const nbBase = baseSlug(nb.id);
                return (
                  <li key={nb.id}>
                    <A
                      href={sunPathname(p.locale, nbBase, monthIndex)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-border-default bg-glass px-4 text-body no-underline hover:bg-surface-elevated"
                    >
                      {localizedCityName(p.locale, nbBase)}
                    </A>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <p className="mt-6 text-body">
          <Link href={cityPathname(p.locale, base)} className="font-semibold text-accent hover:underline">
            {t("vitdCta", { city: cityName })}
          </Link>
        </p>
        {/* Every page that states a figure says where the figure comes from;
            the bibliography lives on /methodology, not repeated here. */}
        <p className="mt-6 text-caption text-text-muted">
          <A href="/methodology">{t("howCalculated")}</A>
        </p>
      </nav>
    </main>
  );
}
