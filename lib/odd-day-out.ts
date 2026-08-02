/**
 * Single days sitting in a different place from the stretches on both sides.
 *
 * This is the one case where a per-cell mark pays: on real data it is one square
 * in thirty — a city checked once during a fortnight elsewhere — so it reads as
 * an exception. Marking every inherited day instead would cover 60% of the grid
 * and mean nothing.
 *
 * A lone day at either end does not count: with nothing before it, starting a
 * new stretch is just moving.
 *
 * Deliberately dependency-free and its own module: both the widget bundle (which
 * has a 40 KB ceiling and cannot pull in the solar model) and the app need the
 * same answer, and the whole point of this work was that the two surfaces stop
 * disagreeing.
 */
export interface OddDaySpan {
  name: string;
  from: string;
  days: number;
}

/** Date → the place that day was in, for days that break their run. */
export function oddDaysOut(spans: readonly OddDaySpan[] | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const all = spans ?? [];
  for (let i = 1; i < all.length - 1; i++) {
    const span = all[i];
    if (span.days !== 1) continue;
    if (all[i - 1].name !== all[i + 1].name) continue;
    if (all[i - 1].name === span.name) continue;
    out.set(span.from, span.name);
  }
  return out;
}
