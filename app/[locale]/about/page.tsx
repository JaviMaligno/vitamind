import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/i18n/metadata";
import A from "@/components/ui/A";

/**
 * The page the schema `Person` node points at. A `Person` with no page behind
 * it is an assertion with nothing to verify, which is the state the site was
 * in before phase 1a.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const alternates = buildAlternates(locale, "/about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates,
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: alternates.canonical },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <main className="mx-auto max-w-[720px] px-4 py-6 sm:py-10">
      <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
        {t("heading")}
      </h1>
      <p className="mt-4 text-body sm:text-heading text-text-secondary leading-relaxed">{t("body")}</p>

      <h2 className="mt-10 font-display text-2xl sm:text-3xl font-bold">{t("whyHeading")}</h2>
      <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("whyBody")}</p>

      <h2 className="mt-10 font-display text-2xl sm:text-3xl font-bold">{t("contactHeading")}</h2>
      <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("contactBody")}</p>
      <p className="mt-4 text-body">
        <A href="https://javieraguilar.ai" target="_blank" rel="noopener">
          javieraguilar.ai
        </A>
      </p>
    </main>
  );
}
