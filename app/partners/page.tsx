"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

const CONTACT_EMAIL = "javiturco33@gmail.com";

const WHY_ITEMS = [
  { icon: "🎯", titleKey: "why1Title", textKey: "why1Text" },
  { icon: "🔬", titleKey: "why2Title", textKey: "why2Text" },
  { icon: "🌍", titleKey: "why3Title", textKey: "why3Text" },
  { icon: "📊", titleKey: "why4Title", textKey: "why4Text" },
];

const MODELS = [
  { icon: "⭐", titleKey: "model1Title", textKey: "model1Text" },
  { icon: "🔗", titleKey: "model2Title", textKey: "model2Text" },
  { icon: "📝", titleKey: "model3Title", textKey: "model3Text" },
];

const FEATURES = [
  "feat1", "feat2", "feat3", "feat4",
  "feat5", "feat6", "feat7", "feat8",
];

export default function PartnersPage() {
  const t = useTranslations("partners");

  return (
    <div className="mx-auto max-w-[960px] px-4 pb-16 space-y-12">
      {/* Hero */}
      <section className="pt-4 space-y-4">
        <h1 className="text-2xl font-bold text-text-primary leading-tight">
          {t("pageTitle")}
        </h1>
        <p className="text-[15px] font-medium text-text-secondary">
          {t("pageSubtitle")}
        </p>
        <p className="text-[13px] text-text-muted leading-relaxed">
          {t("heroDescription")}
        </p>
      </section>

      {/* Why partner */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">
          {t("whyTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WHY_ITEMS.map((item) => (
            <div
              key={item.titleKey}
              className="rounded-xl border border-border-default bg-surface-card p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.icon}</span>
                <h3 className="text-[13px] font-semibold text-text-primary">
                  {t(item.titleKey)}
                </h3>
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {t(item.textKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Partnership models */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">
          {t("modelsTitle")}
        </h2>
        <div className="space-y-3">
          {MODELS.map((model, i) => (
            <div
              key={model.titleKey}
              className="rounded-xl border border-border-default bg-surface-card p-5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{model.icon}</span>
                <h3 className="text-[14px] font-semibold text-text-primary">
                  {t(model.titleKey)}
                </h3>
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {t(model.textKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">
          {t("featuresTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEATURES.map((key) => (
            <div
              key={key}
              className="flex items-start gap-2 text-[12px] text-text-secondary"
            >
              <span className="text-amber-500 mt-0.5">&#10003;</span>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-600/10 p-6 space-y-4 text-center">
        <h2 className="text-xl font-bold text-text-primary">
          {t("ctaTitle")}
        </h2>
        <p className="text-[13px] text-text-muted max-w-lg mx-auto leading-relaxed">
          {t("ctaText")}
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Partnership%20—%20Vitamina%20D%20Explorer`}
          className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-[14px] shadow-lg hover:shadow-xl hover:from-amber-400 hover:to-amber-500 transition-all"
        >
          {t("ctaEmail")}
        </a>
        <p className="text-[11px] text-text-faint">
          {t("ctaNote")}
        </p>
      </section>

      {/* Back link */}
      <div className="pt-2 border-t border-border-subtle">
        <Link
          href="/explore"
          className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          ← Try the app
        </Link>
      </div>
    </div>
  );
}
