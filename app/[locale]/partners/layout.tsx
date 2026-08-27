import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/metadata";

/**
 * The metadata is READ FROM `messages`, and that is the whole point of this
 * file rather than an implementation detail of it.
 *
 * It used to be two hardcoded `Record<string, string>` objects here, with `es`
 * and `en` only and every other locale falling back to English. The body of the
 * page stopped promising an audience on 2026-08-26 — that claim was what invited
 * "come back when you have users" — but the hardcoded description did not move
 * with it, because nothing forces a TSX literal to track a copy rewrite. The
 * visible page was honest and the snippet Google and the AI assistants quote was
 * not, which is the worse half to get wrong.
 *
 * In `messages` the copy is covered by `messages/__tests__/key-parity.test.ts`,
 * so the keys cannot exist in Spanish alone, and it sits in the same file a copy
 * rewrite already opens. The description must keep saying what
 * `partners.pageSubtitle` and `partners.why4Text` say: surface, not audience.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partners" });
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    alternates: buildAlternates(locale, "/partners"),
    openGraph: { title, description },
  };
}

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
