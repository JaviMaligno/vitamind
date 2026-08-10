import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/i18n/metadata";
import { REFERENCES } from "@/lib/references";
import A from "@/components/ui/A";
import Card from "@/components/ui/Card";

/**
 * How every number on the site is produced, with its bibliography, its limits
 * and its correction history. The limits and the changelog are the load-bearing
 * parts: anyone can publish a formula, and a model that has never been wrong in
 * public is a model nobody has checked.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "methodology" });
  const alternates = buildAlternates(locale, "/methodology");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates,
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: alternates.canonical },
  };
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl sm:text-3xl font-bold">{heading}</h2>
      <p className="mt-3 text-body text-text-secondary leading-relaxed">{body}</p>
    </section>
  );
}

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "methodology" });

  return (
    <main className="mx-auto max-w-[760px] px-4 py-6 sm:py-10">
      <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
        {t("heading")}
      </h1>
      <p className="mt-4 text-body sm:text-heading text-text-secondary leading-relaxed">{t("intro")}</p>

      <Section heading={t("sunHeading")} body={t("sunBody")} />
      <Section heading={t("uvHeading")} body={t("uvBody")} />
      <Section heading={t("vitdHeading")} body={t("vitdBody")} />
      <Section heading={t("thresholdHeading")} body={t("thresholdBody")} />
      <Section heading={t("limitsHeading")} body={t("limitsBody")} />

      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("changelogHeading")}</h2>
        <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("changelogBody")}</p>
        <Card variant="glass" className="mt-4 !p-5 sm:!p-6">
          <p className="text-caption font-semibold uppercase tracking-wider text-text-muted">
            {t("changelog1Date")}
          </p>
          <p className="mt-2 text-body text-text-secondary leading-relaxed">{t("changelog1Body")}</p>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("referencesHeading")}</h2>
        <ul className="mt-4 space-y-3">
          {Object.entries(REFERENCES).map(([id, ref]) => (
            <li key={id} className="text-caption sm:text-body text-text-secondary leading-relaxed">
              <A href={ref.url} target="_blank" rel="noopener">
                {ref.label}
              </A>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("reviewHeading")}</h2>
        <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("reviewPending")}</p>
      </section>
    </main>
  );
}
