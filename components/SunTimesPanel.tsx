"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sunrise, Sunset, Sun, Hourglass } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";
import { getSunTimes, type SunTimes } from "@/lib/sun-times";
import { fmtTime } from "@/lib/solar";
import Card from "@/components/ui/Card";

interface Props {
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  /** Optional card title (the dashboard shows one; city pages bring their own h2). */
  title?: string;
}

function fmtDayLength(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/**
 * "The sun today" panel: sunrise, sunset, evening golden hour and day length
 * (with its day-over-day trend). Client-only — the values depend on the
 * visitor's "today", so they are computed after mount (city pages are static
 * HTML; rendering them server-side would freeze them at build time).
 */
export default function SunTimesPanel({ lat, lon, tz, timezone, title }: Props) {
  const t = useTranslations("sunTimes");
  const mounted = useMounted();
  const [st, setSt] = useState<SunTimes | null>(null);

  useEffect(() => {
    function compute() {
      setSt(getSunTimes(lat, lon, new Date(), timezone, tz));
    }
    compute();
    // Refresh once a minute so a tab left open overnight rolls to the new day.
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [lat, lon, tz, timezone]);

  const delta = st ? Math.round(st.dayLengthDeltaMin) : 0;
  const deltaText =
    delta > 0 ? t("longer", { minutes: delta })
    : delta < 0 ? t("shorter", { minutes: -delta })
    : t("same");

  return (
    <Card variant="glass" className="!p-5 sm:!p-6">
      {title && (
        <h2 className="font-display text-title font-bold text-text-primary mb-4">{title}</h2>
      )}

      {!mounted || !st ? (
        <div className="animate-pulse grid grid-cols-2 sm:grid-cols-4 gap-4" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-surface-elevated" />
              <div className="h-6 w-16 rounded bg-surface-elevated" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {st.polar && (
            <p className="mb-4 text-body text-text-secondary">
              {st.polar === "day" ? t("polarDay") : t("polarNight")}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="flex items-center gap-1.5 text-caption uppercase tracking-wider text-text-muted">
                <Sunrise className="h-4 w-4 shrink-0" aria-hidden /> {t("sunrise")}
              </span>
              <span className="mt-1 block font-mono text-xl font-semibold text-text-primary">
                {st.sunrise !== null ? fmtTime(st.sunrise) : "—"}
              </span>
            </div>
            <div>
              <span className="flex items-center gap-1.5 text-caption uppercase tracking-wider text-text-muted">
                <Sunset className="h-4 w-4 shrink-0" aria-hidden /> {t("sunset")}
              </span>
              <span className="mt-1 block font-mono text-xl font-semibold text-text-primary">
                {st.sunset !== null ? fmtTime(st.sunset) : "—"}
              </span>
            </div>
            <div>
              <span className="flex items-center gap-1.5 text-caption uppercase tracking-wider text-text-muted">
                <Sun className="h-4 w-4 shrink-0" aria-hidden /> {t("goldenHour")}
              </span>
              <span className="mt-1 block font-mono text-xl font-semibold text-text-primary">
                {st.goldenEveningStart !== null && st.sunset !== null
                  ? `${fmtTime(st.goldenEveningStart)} – ${fmtTime(st.sunset)}`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="flex items-center gap-1.5 text-caption uppercase tracking-wider text-text-muted">
                <Hourglass className="h-4 w-4 shrink-0" aria-hidden /> {t("dayLength")}
              </span>
              <span className="mt-1 block font-mono text-xl font-semibold text-text-primary">
                {fmtDayLength(st.dayLengthMin)}
              </span>
              <span className="block text-caption text-text-faint mt-0.5">{deltaText}</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
