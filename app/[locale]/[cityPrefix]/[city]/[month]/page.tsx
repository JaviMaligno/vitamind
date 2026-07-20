import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
import PhaseWindow from "@/components/PhaseWindow";
import {
  SUNRISE_CITIES, MONTH_SLUGS, resolveSunPage, sunPathname, sunStaticParams, buildSunAlternates,
} from "@/lib/sun-routes";
import { baseSlug, cityPathname, localizedCityName } from "@/lib/city-routes";
import { nearbyCities } from "@/lib/city-nearby";
import { capFirst, monthName } from "@/lib/city-copy";
import { dailySunTimes, getSunTimes } from "@/lib/sun-times";
import { getCurve, dayOfYear, fmtTime } from "@/lib/solar";
import { computeExposureFromCurve } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

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

type Params = { locale: string; cityPrefix: string; city: string; month: string };

const fmtDayLen = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;
const t2 = (h: number | null) => (h !== null ? fmtTime(h) : "—");

function monthData(lat: number, lon: number, tz: number, timezone: string | undefined, elevationM: number, monthIndex: number) {
  const days = dailySunTimes(lat, lon, monthIndex, timezone, tz);
  const first = days[0];
  const last = days[days.length - 1];
  const dayLen = (d: { sunrise: number | null; sunset: number | null }) =>
    d.sunrise !== null && d.sunset !== null ? (d.sunset - d.sunrise) * 60 : null;

  const firstLen = dayLen(first);
  const lastLen = dayLen(last);
  const deltaMin = firstLen !== null && lastLen !== null ? Math.round(lastLen - firstLen) : 0;

  const mid = getSunTimes(lat, lon, new Date(2026, monthIndex, 15), timezone, tz);

  const doy15 = dayOfYear(new Date(2026, monthIndex, 15));
  const exposure = computeExposureFromCurve(
    getCurve(lat, lon, doy15, tz, timezone), 3, 0.25, 1000, null,
    { ozoneDu: ozoneDU(lat, lon, doy15), elevationM },
  );

  return { days, first, last, deltaMin, mid, exposure, dayLen };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const resolved = resolveSunPage(p.locale, p.cityPrefix, p.city, p.month);
  if (!resolved) return {};
  const t = await getTranslations({ locale: p.locale, namespace: "sunrisePage" });
  const labels = {
    city: localizedCityName(p.locale, resolved.base),
    month: monthName(p.locale, resolved.monthIndex),
  };
  const alternates = buildSunAlternates(p.locale, resolved.base, resolved.monthIndex);
  const title = t("metaTitle", labels);
  const description = t("metaDescription", labels);
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical, type: "article" },
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

  const cityName = localizedCityName(p.locale, base);
  const month = monthName(p.locale, monthIndex);
  const { days, first, last, deltaMin, mid, exposure, dayLen } = monthData(
    city.lat, city.lon, city.tz, city.timezone, city.elevation ?? 0, monthIndex,
  );

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

  const midLen = dayLen(mid) !== null ? fmtDayLen(dayLen(mid)!) : "—";

  const faq = [
    {
      "@type": "Question",
      name: t("faqSunriseQ", { city: cityName, month }),
      acceptedAnswer: {
        "@type": "Answer",
        text: t("faqSunriseA", { month, first: t2(first.sunrise), lastDay: days.length, last: t2(last.sunrise) }),
      },
    },
    {
      "@type": "Question",
      name: t("faqDayQ", { city: cityName, month }),
      acceptedAnswer: { "@type": "Answer", text: t("faqDayA", { dayLength: midLen }) },
    },
  ];

  const nearby = nearbyCities(city.id)
    .filter((nb) => SUNRISE_CITIES.includes(baseSlug(nb.id)))
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq }),
        }}
      />

      <p className="text-caption font-semibold uppercase tracking-[0.2em] text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
        {t("title", { city: cityName, month })}
      </h1>
      <p className="mt-4 text-body sm:text-heading text-text-secondary max-w-2xl leading-relaxed">{intro}</p>

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
                    <td className="px-2 py-1.5 sm:px-4 whitespace-nowrap">{len !== null ? fmtDayLen(len) : "—"}</td>
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
      </nav>
    </main>
  );
}
