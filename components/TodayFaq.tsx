"use client";

import { useTranslations } from "next-intl";
import { useToday } from "@/components/TodayProvider";

/**
 * The hub's FAQ list.
 *
 * The window and sun-times answers are day-dependent, so they read the same
 * `TodayProvider` state as the stat panel above and are corrected on mount with
 * it. Before this component existed they were server-rendered while the panel
 * was not, which on a regime-flip day put "no window today" and "between 12:00
 * and 16:00" on the same screen.
 *
 * The year answer is not day-dependent — `cityYearProfile` walks all 365 days —
 * so it arrives already translated from the server and is the only entry the
 * page also emits as FAQPage structured data.
 */

interface Props {
  /** Pre-rendered on the server: its month names need locale data this side does not carry. */
  year: { q: string; a: string };
}

export default function TodayFaq({ year }: Props) {
  const t = useTranslations("sunToday");
  const { shown, cityName } = useToday();

  const entries = [
    { q: t("faqWindowQ", { city: cityName }), a: t(shown.windowKey, shown.values) },
    { q: t("faqSunQ", { city: cityName }), a: t(shown.sunKey, shown.sunValues) },
    year,
  ];

  return (
    <dl className="mt-4 space-y-4">
      {entries.map(({ q, a }) => (
        <div key={q}>
          <dt className="font-display text-title font-semibold text-text-primary">{q}</dt>
          <dd className="mt-1 text-body text-text-secondary leading-relaxed">{a}</dd>
        </div>
      ))}
    </dl>
  );
}
