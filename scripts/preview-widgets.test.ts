/**
 * Renders the widgets to a standalone HTML page with sample data, so they can be
 * looked at without a deploy and without opening a chat. The render functions are
 * pure and return HTML; this only feeds them.
 *
 *   npx vitest run scripts/preview-widgets.ts
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { renderDay } from "../widgets/day-curve/render";
import { renderHistory } from "../widgets/history/render";
import type { DayMeta, SolarPhase } from "../widgets/day-curve/data";
import type { HistoryMeta } from "../widgets/history/data";

const OUT = process.env.PREVIEW_OUT ?? "widget-preview.html";

const day = (phase: SolarPhase): DayMeta => ({
  state: "good_now", intensity: "moderate", phase, uvIndex: 4.9, minutesNeeded: 11,
  windowStart: 11, windowEnd: 19, minutesUntilWindow: null, windowClosesInMinutes: 72,
  bestHour: 15, bestMinutes: 9, cloudCoverPercent: 20, cloudDegraded: false,
});

/**
 * The user's real shape, as the tool now answers it: every day in the span has a
 * verdict, and only "did you go out" can be blank. Amber days are answerable,
 * emerald ones were answered.
 */
const histDay = (date: string, over: Partial<HistoryMeta["days"][number]> = {}) =>
  ({ date, viableSun: true, wentOutside: null, known: true, ...over });

const sparse: HistoryMeta = {
  authenticated: true,
  from: "2026-07-04",
  to: "2026-08-02",
  streak: 0,
  daysTracked: 11,
  // Three stretches, one of them a single day between two fortnights in the
  // same place — the case a proportional bar cannot draw.
  locations: [
    { name: "Londres", from: "2026-07-04", to: "2026-07-19", days: 16, assumedDays: 9 },
    { name: "Valencia", from: "2026-07-20", to: "2026-07-20", days: 1, assumedDays: 0 },
    { name: "Londres", from: "2026-07-21", to: "2026-08-02", days: 13, assumedDays: 9 },
  ],
  days: [
    ...Array.from({ length: 30 }, (_, i) =>
      histDay(new Date(Date.UTC(2026, 6, 4 + i)).toISOString().slice(0, 10))),
    // What the history actually recorded, laid over the derived days.
    ...["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"].map((date) => histDay(date, { wentOutside: true })),
    histDay("2026-07-17", { wentOutside: false }),
    ...["2026-07-27", "2026-07-28", "2026-07-29"].map((date) => histDay(date, { wentOutside: true })),
    // A genuinely dim day, and one that could not be placed at all.
    histDay("2026-07-23", { viableSun: false }),
    histDay("2026-07-06", { viableSun: false, known: false }),
  ].filter((d, i, all) => all.findLastIndex((x) => x.date === d.date) === i),
};

const panel = (title: string, body: string) =>
  `<section><h2>${title}</h2><div class="frame">${body}</div></section>`;

it("writes the preview page", () => {
  const phases: SolarPhase[] = ["dawn", "day", "dusk", "night"];
  const html = [
    `<style>
      body{margin:0;padding:32px;background:#12141a;color:#e8eaf0;font:15px/1.5 system-ui,sans-serif}
      h1{font-size:20px;margin:0 0 4px} p.lead{margin:0 0 28px;color:#9aa1b0;max-width:60ch}
      .grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));max-width:1200px}
      h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8b93a5;margin:0 0 8px;font-weight:600}
      .frame{background:#1b1e26;border-radius:14px;padding:16px}
    </style>`,
    `<h1>Widgets — vista previa</h1>`,
    `<p class="lead">Datos de ejemplo, render real. Los cuatro cielos son la fase solar; el calendario tiene un día sin ubicación (6 jul) y otro sin sol útil (23 jul).</p>`,
    `<div class="grid">`,
    ...phases.map((p) => panel(p, renderDay({ meta: day(p), locale: "es", theme: "dark" }))),
    panel("historial — cada día del tramo, respondido o no", renderHistory({ meta: sparse, locale: "es", theme: "dark" })),
    `</div>`,
  ].join("\n");
  writeFileSync(OUT, html);
  console.log(`wrote ${OUT}`);
});
