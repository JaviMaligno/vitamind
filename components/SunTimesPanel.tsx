"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sunrise, Sunset, Sun, Hourglass } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";
import { getSunTimes, type SunTimes } from "@/lib/sun-times";
import { fmtTime, dayOfYear } from "@/lib/solar";
import { tzOffsetForDate } from "@/lib/timezone";
import PhaseWindow from "@/components/PhaseWindow";

interface Props {
  lat: number;
  lon: number;
  tz: number;
  timezone?: string;
  /** Optional title rendered inside the window (city pages bring their own h2). */
  title?: string;
  /** Show sun times for this date instead of "today" (Explore's date scrubber).
      The live sun dot only renders when the date is actually today. */
  date?: Date;
}

function fmtDayLength(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/** Quadratic Bézier for the sun path: horizon (40,150) → apex → horizon (560,150). */
const P0 = { x: 40, y: 150 };
const P1 = { x: 300, y: -50 };
const P2 = { x: 560, y: 150 };
function arcPoint(t: number) {
  const u = 1 - t;
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
  };
}

/**
 * "The sun today" as a sky-window poster: the sun's day arc from sunrise to
 * sunset (golden-hour ends warm, midday pale) with a live sun dot at the
 * current position, over the phase-tinted window surface. Client-only — the
 * values depend on the visitor's "today" (city pages are static HTML, so a
 * server render would freeze them at build time).
 */
export default function SunTimesPanel({ lat, lon, tz, timezone, title, date }: Props) {
  const t = useTranslations("sunTimes");
  const mounted = useMounted();
  const [st, setSt] = useState<SunTimes | null>(null);
  const [nowLocal, setNowLocal] = useState<number | null>(null);
  // Primitive dep: a `Date` prop is a fresh object every parent render and
  // would retrigger the effect (and its interval) each time.
  const dateMs = date?.getTime();

  useEffect(() => {
    function compute() {
      const now = new Date();
      const target = dateMs !== undefined ? new Date(dateMs) : now;
      setSt(getSunTimes(lat, lon, target, timezone, tz));
      // The dot only makes sense when the panel shows the current day.
      if (dayOfYear(target) === dayOfYear(now)) {
        const offset = timezone ? tzOffsetForDate(timezone, now) : tz;
        setNowLocal((((now.getUTCHours() + now.getUTCMinutes() / 60 + offset) % 24) + 24) % 24);
      } else {
        setNowLocal(null);
      }
    }
    compute();
    // Refresh once a minute so the dot moves and an overnight tab rolls to the
    // new day. Timers freeze while a PWA is backgrounded, so also recompute on
    // visibilitychange — otherwise a warm resume shows the sun where it was
    // hours ago (same failure mode as useSolarPhase).
    const id = setInterval(compute, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") compute();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [lat, lon, tz, timezone, dateMs]);

  const delta = st ? Math.round(st.dayLengthDeltaMin) : 0;
  const deltaText =
    delta > 0 ? t("longer", { minutes: delta })
    : delta < 0 ? t("shorter", { minutes: -delta })
    : t("same");

  // Golden-hour fractions along the daylight span, for the arc gradient stops.
  let gm = 0.14;
  let ge = 0.86;
  let tNow: number | null = null;
  if (st && st.sunrise !== null && st.sunset !== null && st.sunset > st.sunrise) {
    const span = st.sunset - st.sunrise;
    if (st.goldenMorningEnd !== null) gm = Math.min(0.45, (st.goldenMorningEnd - st.sunrise) / span);
    if (st.goldenEveningStart !== null) ge = Math.max(0.55, (st.goldenEveningStart - st.sunrise) / span);
    if (nowLocal !== null) tNow = (nowLocal - st.sunrise) / span;
  }
  const sunUp = tNow !== null && tNow >= 0 && tNow <= 1;
  const sun = sunUp ? arcPoint(tNow!) : null;

  return (
    <PhaseWindow lat={lat} lon={lon} className="p-5 sm:p-6 text-on-window">
      {title && <h2 className="font-display text-title font-bold mb-1">{title}</h2>}

      {!mounted || !st ? (
        <div className="animate-pulse space-y-4 py-6" aria-hidden>
          <div className="h-24 rounded-xl bg-white/10" />
          <div className="h-5 w-2/3 rounded bg-white/10" />
        </div>
      ) : st.polar ? (
        <div className="py-4 space-y-2">
          <p className="text-body">{st.polar === "day" ? t("polarDay") : t("polarNight")}</p>
          <p className="flex items-center gap-2 text-caption opacity-70">
            <Hourglass className="h-4 w-4 shrink-0" aria-hidden />
            {t("dayLength")}: <span className="font-mono">{fmtDayLength(st.dayLengthMin)}</span>
            <span>· {deltaText}</span>
          </p>
        </div>
      ) : (
        <>
          {/* The day arc. Warm ends = golden hour, pale crown = full day. */}
          <svg viewBox="0 0 600 170" className="w-full h-auto" aria-hidden>
            <defs>
              <linearGradient id="sun-arc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ff9d5e" />
                <stop offset={gm} stopColor="#ffe9b0" />
                <stop offset={ge} stopColor="#ffe9b0" />
                <stop offset="1" stopColor="#ff8b4a" />
              </linearGradient>
              <radialGradient id="sun-dot">
                <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                <stop offset="0.45" stopColor="#ffd77a" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* horizon */}
            <line x1="0" y1="150" x2="600" y2="150" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
            {/* the path itself, dimmed while the sun is below the horizon */}
            <path
              d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
              fill="none"
              stroke="url(#sun-arc)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity={sunUp ? 0.95 : 0.45}
            />
            {/* horizon ticks at the touchdown points */}
            <line x1={P0.x} y1="143" x2={P0.x} y2="157" stroke="#ffb25e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={P2.x} y1="143" x2={P2.x} y2="157" stroke="#ff9d5e" strokeWidth="2.5" strokeLinecap="round" />
            {/* live sun */}
            {sun && (
              <>
                <circle cx={sun.x} cy={sun.y} r="22" fill="url(#sun-dot)" />
                <circle cx={sun.x} cy={sun.y} r="6.5" fill="#fff" />
              </>
            )}
          </svg>

          {/* sunrise / sunset anchored under the arc's ends */}
          <div className="flex items-start justify-between -mt-1">
            <div>
              <span className="flex items-center gap-1.5 text-caption uppercase tracking-wider opacity-70">
                <Sunrise className="h-4 w-4 shrink-0" aria-hidden /> {t("sunrise")}
              </span>
              <span className="mt-0.5 block font-mono text-2xl font-semibold">{fmtTime(st.sunrise!)}</span>
            </div>
            <div className="text-right">
              <span className="flex items-center justify-end gap-1.5 text-caption uppercase tracking-wider opacity-70">
                <Sunset className="h-4 w-4 shrink-0" aria-hidden /> {t("sunset")}
              </span>
              <span className="mt-0.5 block font-mono text-2xl font-semibold">{fmtTime(st.sunset!)}</span>
            </div>
          </div>

          {/* golden hour + day length */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 pt-3">
            {st.goldenEveningStart !== null && (
              <span className="flex items-center gap-1.5 text-caption sm:text-body">
                <Sun className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span className="opacity-70">{t("goldenHour")}</span>
                <span className="font-mono font-semibold whitespace-nowrap">
                  {fmtTime(st.goldenEveningStart)}–{fmtTime(st.sunset!)}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-caption sm:text-body">
              <Hourglass className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <span className="font-mono font-semibold whitespace-nowrap">{fmtDayLength(st.dayLengthMin)}</span>
              <span className="opacity-70">· {deltaText}</span>
            </span>
          </div>
        </>
      )}
    </PhaseWindow>
  );
}
