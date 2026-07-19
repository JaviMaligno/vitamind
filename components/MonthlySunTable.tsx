"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { dailySunTimes, type MonthlySunTimes } from "@/lib/sun-times";
import { fmtTime } from "@/lib/solar";
import Card from "@/components/ui/Card";

interface Labels {
  month: string;
  sunrise: string;
  sunset: string;
  dayLength: string;
  day: string;
  dawn: string;
  dusk: string;
  dayByDay: string;
  twilightNote: string;
}

interface Props {
  monthly: MonthlySunTimes[];
  /** Localized capitalized month names, index-aligned with `monthly`. */
  monthNames: string[];
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  labels: Labels;
}

function fmtDayLen(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

const time = (h: number | null) => (h !== null ? fmtTime(h) : "—");

/**
 * The monthly sunrise/sunset table with expandable day-by-day detail. The
 * 12-row summary ships in the static HTML (it's the indexable SEO content —
 * this component's first render happens on the server); the per-day rows,
 * including civil dawn/dusk, are computed client-side only when a month is
 * opened, so the 438 static city pages don't carry 365 rows each.
 */
export default function MonthlySunTable({ monthly, monthNames, lat, lon, tz, timezone, labels }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  const days = useMemo(
    () => (open === null ? null : dailySunTimes(lat, lon, open, timezone, tz)),
    [open, lat, lon, timezone, tz],
  );

  return (
    <Card variant="glass" className="!p-0 overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="text-left text-caption uppercase tracking-wider text-text-muted">
            <th className="px-3 py-3 sm:px-6 font-medium">{labels.month}</th>
            <th className="px-3 py-3 sm:px-6 font-medium">{labels.sunrise}</th>
            <th className="px-3 py-3 sm:px-6 font-medium">{labels.sunset}</th>
            <th className="hidden sm:table-cell px-3 py-3 sm:px-6 font-medium">{labels.dayLength}</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((m) => {
            const isOpen = open === m.monthIndex;
            return [
              <tr key={m.monthIndex} className="border-t border-border-subtle">
                <td className="px-3 py-2.5 sm:px-6 font-medium">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : m.monthIndex)}
                    aria-expanded={isOpen}
                    aria-label={`${monthNames[m.monthIndex]} — ${labels.dayByDay}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 cursor-pointer text-text-primary hover:text-accent transition-colors"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-accent transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                    {monthNames[m.monthIndex]}
                  </button>
                </td>
                <td className="px-3 py-2.5 sm:px-6 font-mono">{time(m.sunrise)}</td>
                <td className="px-3 py-2.5 sm:px-6 font-mono">{time(m.sunset)}</td>
                <td className="hidden sm:table-cell px-3 py-2.5 sm:px-6 whitespace-nowrap">{fmtDayLen(m.dayLengthMin)}</td>
              </tr>,
              isOpen && days && (
                <tr key={`${m.monthIndex}-days`} className="border-t border-border-subtle">
                  <td colSpan={4} className="px-3 pb-4 pt-1 sm:px-6 bg-surface-elevated/40">
                    <table className="w-full text-caption sm:text-body">
                      <thead>
                        <tr className="text-left text-caption uppercase tracking-wider text-text-muted">
                          <th className="px-2 py-2 font-medium">{labels.day}</th>
                          <th className="px-2 py-2 font-medium">{labels.dawn}</th>
                          <th className="px-2 py-2 font-medium">{labels.sunrise}</th>
                          <th className="px-2 py-2 font-medium">{labels.sunset}</th>
                          <th className="px-2 py-2 font-medium">{labels.dusk}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((d) => (
                          <tr key={d.day} className="border-t border-border-subtle/60">
                            <td className="px-2 py-1.5 font-medium">{d.day}</td>
                            <td className="px-2 py-1.5 font-mono text-text-muted">{time(d.civilDawn)}</td>
                            <td className="px-2 py-1.5 font-mono">{time(d.sunrise)}</td>
                            <td className="px-2 py-1.5 font-mono">{time(d.sunset)}</td>
                            <td className="px-2 py-1.5 font-mono text-text-muted">{time(d.civilDusk)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 px-2 text-caption text-text-muted">{labels.twilightNote}</p>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </Card>
  );
}
