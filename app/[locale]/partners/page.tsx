"use client";

import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { Target, FlaskConical, Globe, Users, Star, Link2, PenLine, Check, ArrowLeft, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import PosterHero from "@/components/PosterHero";
import PhaseButton from "@/components/PhaseButton";

const CONTACT_EMAIL = "javiecija96@gmail.com";

const WHY_ITEMS: { Icon: LucideIcon; titleKey: string; textKey: string }[] = [
  { Icon: Target, titleKey: "why1Title", textKey: "why1Text" },
  { Icon: FlaskConical, titleKey: "why2Title", textKey: "why2Text" },
  { Icon: Globe, titleKey: "why3Title", textKey: "why3Text" },
  { Icon: Users, titleKey: "why4Title", textKey: "why4Text" },
];

const MODELS: { Icon: LucideIcon; titleKey: string; textKey: string }[] = [
  { Icon: Star, titleKey: "model1Title", textKey: "model1Text" },
  { Icon: Link2, titleKey: "model2Title", textKey: "model2Text" },
  { Icon: PenLine, titleKey: "model3Title", textKey: "model3Text" },
];

const FEATURES = ["feat1", "feat2", "feat3", "feat4", "feat5", "feat6", "feat7", "feat8"];

export default function PartnersPage() {
  const t = useTranslations("partners");

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6 sm:py-8 space-y-10 sm:space-y-14">
      <PosterHero eyebrow={t("eyebrow")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />

      {/* Lede + inline CTA, so the primary action is visible above the fold
          instead of only at the bottom of a long page. */}
      <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <p className="text-body text-text-secondary leading-relaxed max-w-2xl">
          {t("heroDescription")}
        </p>
        <PhaseButton
          href={`mailto:${CONTACT_EMAIL}?subject=Partnership%20—%20Vitamina%20D%20Explorer`}
          className="whitespace-nowrap"
        >
          <Mail className="h-4 w-4" aria-hidden />
          {t("ctaEmail")}
        </PhaseButton>
      </section>

      {/* Why partner */}
      <section className="space-y-5">
        <h2 className="text-title font-display font-bold text-text-primary">
          {t("whyTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WHY_ITEMS.map(({ Icon, titleKey, textKey }) => (
            <div
              key={titleKey}
              className="rounded-2xl border border-glass-border bg-glass backdrop-blur-md p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-heading font-semibold text-text-primary">
                  {t(titleKey)}
                </h3>
              </div>
              <p className="text-body text-text-muted leading-relaxed">
                {t(textKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Partnership models */}
      <section className="space-y-5">
        <h2 className="text-title font-display font-bold text-text-primary">
          {t("modelsTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {MODELS.map(({ Icon, titleKey, textKey }) => (
            <div
              key={titleKey}
              className="rounded-2xl border border-glass-border bg-glass backdrop-blur-md p-5 space-y-3 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-heading font-semibold text-text-primary">
                {t(titleKey)}
              </h3>
              <p className="text-body text-text-muted leading-relaxed">
                {t(textKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="space-y-5">
        <h2 className="text-title font-display font-bold text-text-primary">
          {t("featuresTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((key) => (
            <div key={key} className="flex items-start gap-3 text-body text-text-secondary">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-possible-surface text-possible">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              </span>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-[2rem] border border-glass-border bg-glass backdrop-blur-md p-8 sm:p-10 space-y-4 text-center shadow-lg">
        <h2 className="text-title sm:text-display font-display font-bold text-text-primary">
          {t("ctaTitle")}
        </h2>
        <p className="text-body text-text-muted max-w-xl mx-auto leading-relaxed">
          {t("ctaText")}
        </p>
        <PhaseButton
          href={`mailto:${CONTACT_EMAIL}?subject=Partnership%20—%20Vitamina%20D%20Explorer`}
          className="px-8"
        >
          <Mail className="h-4 w-4" aria-hidden />
          {t("ctaEmail")}
        </PhaseButton>
        <p className="text-caption text-text-faint">
          {t("ctaNote")}
        </p>
      </section>

      {/* Back link */}
      <div className="pt-2 border-t border-border-subtle">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-caption text-text-muted hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("backToApp")}
        </Link>
      </div>
    </main>
  );
}
