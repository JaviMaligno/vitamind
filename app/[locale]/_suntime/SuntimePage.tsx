import { getTranslations } from "next-intl/server";

import Card from "@/components/ui/Card";
import A from "@/components/ui/A";
import { authorship } from "@/lib/schema";
import { capFirst, monthName } from "@/lib/city-copy";
import {
  BANDS,
  BAND_TYPES,
  suntimeBandPathname,
  suntimePathname,
  suntimeUrl,
  suntimeBandUrl,
  type Band,
} from "@/lib/suntime-routes";
import {
  REFERENCE,
  allBandFigures,
  impossibleMonths,
  monthlyMinutes,
} from "@/lib/suntime-content";

/**
 * The mother page and the three band pages, in one component.
 *
 * They share a spine — the answer, the assumptions, the month table, the
 * impossible months, the six types, the method and the disclaimer — and differ
 * in the argument at the top. Keeping them in one file is what makes it obvious
 * that the shared half really is shared, rather than four copies drifting apart.
 *
 * WHAT IS NOT NEGOTIABLE HERE: THE NUMBERS REACH THE VISIBLE BODY.
 * Spec §6, and the reason is measured rather than assumed. Ahrefs compared 1,885
 * pages that added JSON-LD against 4,000 controls and found −4.6% in AI
 * Overviews, significant; a separate study found all five systems tested extract
 * visible HTML and ignore structured data outright. Google says it plainly:
 * there is no schema that helps you be cited. So every figure this page claims
 * is printed in the body, and the JSON-LD is `Article` for the ordinary rich
 * result and nothing more.
 *
 * And none of those figures is written down. They come from
 * `lib/suntime-content.ts`, which derives them from `minutesForVitD` — the rule
 * CLAUDE.md states after five hand-typed claims shipped stale, one of which then
 * got copied into `/methodology` because writing a new page propagated the error
 * instead of catching it.
 */

/** Rounded for display. The model's precision is not the claim's precision. */
function mins(value: number): string {
  return String(Math.round(value));
}

function pct(fraction: number): string {
  return String(Math.round(fraction * 100));
}

export default async function SuntimePage({
  locale,
  band,
}: {
  locale: string;
  /** Absent on the mother page. */
  band?: Band;
}) {
  const t = await getTranslations({ locale, namespace: "suntimePage" });
  const figures = allBandFigures();
  const self = band ? figures[band] : null;
  const rows = monthlyMinutes(band ?? "medium");
  const closed = impossibleMonths();
  const page = band ? `bands.${band}` : "mother";

  const title = t(`${page}.title`);
  const description = t(`${page}.metaDescription`);
  const url = band ? suntimeBandUrl(locale, band) : suntimeUrl(locale);

  // The range the headline quotes. On the mother it spans every band, which is
  // the whole point of that page: the honest answer is not a number.
  const low = self ? self.minMinutes : Math.min(...BANDS.map((b) => figures[b].minMinutes));
  const high = self ? self.maxMinutes : Math.max(...BANDS.map((b) => figures[b].maxMinutes));

  const monthLabel = (month: number) => capFirst(monthName(locale, month - 1));
  const listMonths = (months: number[]) =>
    months.map(monthLabel).join(locale === "en" ? ", " : ", ");

  /**
   * `Article` and `BreadcrumbList`, and none of the three types the draft
   * considered: `HowTo` was retired in 2023, `FAQPage` stopped producing a rich
   * result on 2026-05-07 with its documentation deleted on 2026-06-15, and
   * `MedicalWebPage` was never a type Google read. Spec §6.
   */
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: title,
        description,
        inLanguage: locale,
        mainEntityOfPage: url,
        ...authorship(),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("mother.h1"),
            item: suntimeUrl(locale),
          },
          ...(band
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: t(`bands.${band}.h1`),
                  item: url,
                },
              ]
            : []),
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <header className="mb-8">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-accent">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          {t(`${page}.h1`)}
        </h1>
        <p className="mt-4 text-lg text-text-secondary">{t(`${page}.lead`)}</p>

        {/* THE ANSWER, above everything else and with no form in front of it.
            Spec §4: somebody arriving from a search and meeting a form goes
            back to the search. */}
        <p className="mt-6 font-display text-2xl font-bold leading-snug sm:text-3xl">
          {t(`${page}.answer`, { min: mins(low), max: mins(high) })}
        </p>
      </header>

      {band && (
        <Card className="mb-8">
          <h2 className="font-display text-xl font-bold">{t(`bands.${band}.angleHeading`)}</h2>
          <p className="mt-3 text-text-secondary">{t(`bands.${band}.angleBody`)}</p>
          <p className="mt-3 text-caption text-text-tertiary">{t(`bands.${band}.gloss`)}</p>
        </Card>
      )}

      {!band && (
        <Card className="mb-8">
          <h2 className="font-display text-xl font-bold">{t("mother.whyHeading")}</h2>
          <p className="mt-3 text-text-secondary">{t("mother.whyBody")}</p>
        </Card>
      )}

      {/* The assumptions, on the page rather than in small print. The AI
          Overview answers "10 to 15 minutes" and one of its own sources
          qualifies itself with "Fitzpatrick II-III at ~40°N" — the
          qualification is the answer. Spec §9. */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold">{t("assumptionsHeading")}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-text-secondary">
          <li>{t("assumptionArea", { areaPercent: pct(REFERENCE.areaFraction) })}</li>
          <li>{t("assumptionAge", { age: REFERENCE.age })}</li>
          <li>{t("assumptionTarget", { targetIU: REFERENCE.targetIU })}</li>
          <li>{t("assumptionPlace", { lat: REFERENCE.lat })}</li>
        </ul>
        <p className="mt-3 text-caption text-text-tertiary">{t("targetNote")}</p>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl font-bold">{t("monthHeading")}</h2>
        <p className="mt-1 text-caption text-text-tertiary">{t("monthNote")}</p>
        <ul className="mt-3 space-y-1 text-text-secondary">
          {rows.map((row) => (
            <li key={row.month}>
              {row.minMinutes === null || row.maxMinutes === null
                ? t("monthImpossible", { month: monthLabel(row.month) })
                : t("monthRange", {
                    month: monthLabel(row.month),
                    min: mins(row.minMinutes),
                    max: mins(row.maxMinutes),
                  })}
            </li>
          ))}
        </ul>
      </section>

      {/* The part the AI Overview never gives: below MIN_UVI no duration works,
          so there is an answer that is not a number. */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold">{t("impossibleHeading")}</h2>
        <p className="mt-3 text-text-secondary">
          {closed.length > 0
            ? t("impossibleSome", { months: listMonths(closed) })
            : t("impossibleNone")}
        </p>
      </section>

      {self && (
        <section className="mb-8">
          <h2 className="font-display text-xl font-bold">{t("burnHeading")}</h2>
          <p className="mt-3 text-text-secondary">
            {t("burnBody", {
              minutes: mins(self.minMinutes),
              burnMinutes: mins(self.burnMinutesAtMin),
            })}
          </p>
        </section>
      )}

      {/* Six in the control, three in the content — the individual types stay
          available as detail rather than as pages of their own. Spec §3. */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-bold">{t("typesHeading")}</h2>
        <ul className="mt-3 space-y-1 text-text-secondary">
          {(self ?? figures.medium).byType.map((row) =>
            row.minMinutes === null || row.maxMinutes === null ? null : (
              <li key={row.type}>
                {t("typeRow", {
                  type: row.type,
                  min: mins(row.minMinutes),
                  max: mins(row.maxMinutes),
                })}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl font-bold">
          {band ? t("otherBandsHeading") : t("mother.chooseHeading")}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {BANDS.filter((b) => b !== band).map((b) => (
            <Card key={b}>
              <A href={suntimeBandPathname(locale, b)} className="font-semibold">
                {t(`bands.${b}.h1`)}
              </A>
              <p className="mt-2 text-caption text-text-secondary">{t(`bands.${b}.cardBlurb`)}</p>
              <p className="mt-1 text-caption text-text-tertiary">
                {t("typeRow", {
                  type: `${BAND_TYPES[b][0]}–${BAND_TYPES[b][1]}`,
                  min: mins(figures[b].minMinutes),
                  max: mins(figures[b].maxMinutes),
                })}
              </p>
            </Card>
          ))}
        </div>
        {band && (
          <p className="mt-4">
            <A href={suntimePathname(locale)}>{t("backToMother")}</A>
          </p>
        )}
      </section>

      {/* The bridge to the calculation, which is the one thing neither a search
          engine nor a general assistant has. The skin type travels in the URL so
          the app opens already set to the band the reader just chose. */}
      <Card className="mb-8">
        <A href={band ? `/dashboard?skin=${BAND_TYPES[band][0]}` : "/dashboard"}>
          {t("ctaLabel")}
        </A>
      </Card>

      <section className="mb-8">
        <h2 className="font-display text-xl font-bold">{t("methodHeading")}</h2>
        <p className="mt-3 text-text-secondary">{t("methodBody")}</p>
      </section>

      <p className="text-caption text-text-tertiary">{t("disclaimer")}</p>
    </main>
  );
}

/** Title and description for `generateMetadata`, from the same strings. */
export async function suntimeMeta(locale: string, band?: Band) {
  const t = await getTranslations({ locale, namespace: "suntimePage" });
  const page = band ? `bands.${band}` : "mother";
  return { title: t(`${page}.title`), description: t(`${page}.metaDescription`) };
}
