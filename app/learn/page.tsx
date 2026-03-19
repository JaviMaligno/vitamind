"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import LearnAccordion from "@/components/LearnAccordion";

interface Block {
  emoji: string;
  titleKey: string;
  subtitleKey: string;
  questions: { qKey: string; aKey: string }[];
}

const BLOCKS: Block[] = [
  {
    emoji: "☀️",
    titleKey: "block1.title",
    subtitleKey: "block1.subtitle",
    questions: [
      { qKey: "block1.q1.q", aKey: "block1.q1.a" },
      { qKey: "block1.q2.q", aKey: "block1.q2.a" },
      { qKey: "block1.q3.q", aKey: "block1.q3.a" },
      { qKey: "block1.q4.q", aKey: "block1.q4.a" },
      { qKey: "block1.q5.q", aKey: "block1.q5.a" },
    ],
  },
  {
    emoji: "💊",
    titleKey: "block2.title",
    subtitleKey: "block2.subtitle",
    questions: [
      { qKey: "block2.q1.q", aKey: "block2.q1.a" },
      { qKey: "block2.q2.q", aKey: "block2.q2.a" },
      { qKey: "block2.q3.q", aKey: "block2.q3.a" },
      { qKey: "block2.q4.q", aKey: "block2.q4.a" },
      { qKey: "block2.q5.q", aKey: "block2.q5.a" },
    ],
  },
  {
    emoji: "🧪",
    titleKey: "block3.title",
    subtitleKey: "block3.subtitle",
    questions: [
      { qKey: "block3.q1.q", aKey: "block3.q1.a" },
      { qKey: "block3.q2.q", aKey: "block3.q2.a" },
      { qKey: "block3.q3.q", aKey: "block3.q3.a" },
      { qKey: "block3.q4.q", aKey: "block3.q4.a" },
      { qKey: "block3.q5.q", aKey: "block3.q5.a" },
      { qKey: "block3.q6.q", aKey: "block3.q6.a" },
    ],
  },
  {
    emoji: "🌅",
    titleKey: "block4.title",
    subtitleKey: "block4.subtitle",
    questions: [
      { qKey: "block4.q1.q", aKey: "block4.q1.a" },
      { qKey: "block4.q2.q", aKey: "block4.q2.a" },
      { qKey: "block4.q3.q", aKey: "block4.q3.a" },
      { qKey: "block4.q4.q", aKey: "block4.q4.a" },
      { qKey: "block4.q5.q", aKey: "block4.q5.a" },
    ],
  },
];

export default function LearnPage() {
  const t = useTranslations("learn");

  return (
    <div className="mx-auto max-w-[960px] px-4 pb-12 space-y-8">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-text-primary">{t("pageTitle")}</h1>
        <p className="text-[12px] text-text-faint mt-1">{t("pageSubtitle")}</p>
      </div>

      {/* Blocks */}
      {BLOCKS.map((block, bi) => (
        <section key={bi} id={bi === 2 ? "supplement" : undefined}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{block.emoji}</span>
            <div>
              <h2 className="text-[13px] font-semibold text-text-primary">{t(block.titleKey)}</h2>
              <p className="text-[10px] text-text-faint">{t(block.subtitleKey)}</p>
            </div>
          </div>
          <LearnAccordion
            items={block.questions.map((q) => ({ q: t(q.qKey), a: t(q.aKey) }))}
          />
        </section>
      ))}

      {/* Footer link */}
      <div className="pt-4 border-t border-border-subtle">
        <Link href="/dashboard" className="text-[11px] text-text-muted hover:text-text-secondary transition-colors">
          ← {t("backToApp")}
        </Link>
      </div>
    </div>
  );
}
