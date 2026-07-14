import type { LucideIcon } from "lucide-react";
import { Sun, Pill, FlaskConical, Sunrise } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import PosterHero from "@/components/PosterHero";
import LearnQA from "@/components/LearnQA";
import LearnSearch from "@/components/LearnSearch";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface Block {
  Icon: LucideIcon;
  titleKey: string;
  subtitleKey: string;
  questions: { qKey: string; aKey: string }[];
}

const BLOCKS: Block[] = [
  {
    Icon: Sun,
    titleKey: "block1.title",
    subtitleKey: "block1.subtitle",
    questions: Array.from({ length: 9 }, (_, i) => ({ qKey: `block1.q${i + 1}.q`, aKey: `block1.q${i + 1}.a` })),
  },
  {
    Icon: Pill,
    titleKey: "block2.title",
    subtitleKey: "block2.subtitle",
    questions: Array.from({ length: 5 }, (_, i) => ({ qKey: `block2.q${i + 1}.q`, aKey: `block2.q${i + 1}.a` })),
  },
  {
    Icon: FlaskConical,
    titleKey: "block3.title",
    subtitleKey: "block3.subtitle",
    questions: Array.from({ length: 6 }, (_, i) => ({ qKey: `block3.q${i + 1}.q`, aKey: `block3.q${i + 1}.a` })),
  },
  {
    Icon: Sunrise,
    titleKey: "block4.title",
    subtitleKey: "block4.subtitle",
    questions: Array.from({ length: 5 }, (_, i) => ({ qKey: `block4.q${i + 1}.q`, aKey: `block4.q${i + 1}.a` })),
  },
];

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("learn");

  // Resolve each block's Q&A on the server so the answers ship in the static HTML.
  const blocks = BLOCKS.map((block) => ({
    ...block,
    items: block.questions.map((q) => {
      const baseKey = q.qKey.replace(/\.q$/, "");
      let sources: { label: string; url: string }[] | undefined;
      try {
        const raw = t.raw(`${baseKey}.sources`);
        if (Array.isArray(raw)) sources = raw as { label: string; url: string }[];
      } catch {
        // No sources for this question — leave undefined.
      }
      return { q: t(q.qKey), a: t(q.aKey), sources };
    }),
  }));

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:py-8 space-y-8 sm:space-y-10">
      <PosterHero eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        {/* Table of contents — jump links, sticky on desktop. */}
        <nav aria-label={t("pageTitle")} className="mb-8 lg:mb-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {blocks.map((block, i) => (
              <li key={i}>
                <a
                  href={`#block-${i + 1}`}
                  className="inline-flex items-center gap-2 rounded-full bg-glass border border-glass-border backdrop-blur-md px-3 py-1.5 text-caption text-text-secondary shadow-lg transition-colors hover:bg-surface-elevated lg:rounded-lg lg:w-full"
                >
                  <block.Icon className="h-4 w-4 text-accent shrink-0" aria-hidden />
                  <span>{t(block.titleKey)}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* FAQ content — a readable measure inside the wide layout. */}
        <div className="max-w-3xl">
          <LearnSearch
            placeholder={t("searchPlaceholder")}
            noResults={t("searchNoResults")}
            clearLabel={t("searchClear")}
          />
          <div className="space-y-10">
          {blocks.map((block, bi) => (
            <section
              key={bi}
              id={`block-${bi + 1}`}
              data-qa-block
              className="scroll-mt-6"
              {...(bi === 2 ? { "data-alias": "supplement" } : {})}
            >
              {/* Anchor alias for /learn#supplement */}
              {bi === 2 && <div id="supplement" className="sr-only" />}
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-accent" aria-hidden>
                  <block.Icon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-text-primary">
                    {t(block.titleKey)}
                  </h2>
                  <p className="text-caption text-text-muted">{t(block.subtitleKey)}</p>
                </div>
              </div>
              <LearnQA items={block.items} sourcesLabel={t("sourcesLabel")} />
            </section>
          ))}
          </div>
        </div>
      </div>

      {/* Footer link */}
      <div className="border-t border-border-subtle pt-4">
        <Link href="/dashboard" className="text-caption text-text-muted hover:text-text-secondary transition-colors">
          ← {t("backToApp")}
        </Link>
      </div>
    </main>
  );
}
