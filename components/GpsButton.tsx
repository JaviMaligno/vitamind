"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import GpsErrorHint from "@/components/GpsErrorHint";

export default function GpsButton() {
  const t = useTranslations("hero");
  const app = useApp();
  const { gps, cityId } = app;

  const isActive = cityId.startsWith("gps:");
  // permissionDenied covers the silent auto-request on mount: no error pill is
  // shown for it, but the icon still signals that GPS is blocked.
  const isDenied = gps.error === "gpsDenied" || gps.permissionDenied;

  const showHint = (gps.slow && !gps.error) || Boolean(gps.error);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // The hint hangs below the button, right-aligned to it — but the button can
  // sit near either screen edge (left on Profile, right on Dashboard), so an
  // edge-anchored popover can run off-screen. Clamp it to the viewport by
  // shifting it relative to the button.
  useLayoutEffect(() => {
    if (!showHint || !wrapRef.current || !hintRef.current) {
      setShift(0);
      return;
    }
    const btn = wrapRef.current.getBoundingClientRect();
    const hint = hintRef.current.getBoundingClientRect();
    let left = btn.right - hint.width;
    left = Math.max(12, Math.min(left, window.innerWidth - hint.width - 12));
    setShift(left - btn.left);
  }, [showHint, gps.error, gps.slow]);

  const iconColor = gps.loading
    ? "text-text-muted"
    : isActive
      ? "text-emerald-400"
      : isDenied
        ? "text-red-600 dark:text-red-400"
        : "text-accent";

  // Contained glass surface in every state so the icon keeps contrast on any
  // phase gradient (it used to float on a near-invisible bg-surface-card). The
  // denied state keeps the glass frost and signals error with a red border +
  // red icon only — a translucent red *fill* vibrated illegibly ("neon") on the
  // bright day-phase gradient.
  const bgColor = gps.loading
    ? "bg-glass border border-glass-border"
    : isActive
      ? "bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25"
      : isDenied
        ? "bg-glass border border-red-500/40 hover:bg-surface-elevated"
        : "bg-glass border border-glass-border hover:bg-surface-elevated";

  return (
    // The wrapper is exactly the button's size (shrink-0) so it never grows the
    // surrounding flex row. The slow/error hints are absolutely positioned below
    // the icon (decoupled from layout) so they stay visible without displacing
    // the icon or squeezing the adjacent search field.
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        onClick={gps.enableGps}
        disabled={gps.loading}
        title={t("useMyLocation")}
        aria-label={t("useMyLocation")}
        className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${bgColor}`}
      >
        {gps.loading ? (
          <svg
            className={`w-5 h-5 animate-spin ${iconColor}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-5 h-5 ${iconColor}`}
          >
            <path
              fillRule="evenodd"
              d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      {showHint ? (
        <div
          ref={hintRef}
          className="absolute top-full mt-2 z-40 w-max max-w-[min(240px,calc(100vw-24px))]"
          style={{ left: shift }}
        >
          {gps.slow && !gps.error && (
            <p className="text-[10px] text-accent/60 max-w-[180px] leading-tight animate-pulse">
              {t("gpsEnableHint")}
            </p>
          )}
          {gps.error && (
            <GpsErrorHint
              error={t(gps.error)}
              hint={
                gps.error === "gpsDenied" ? t("gpsDeniedHint")
                : (gps.error === "gpsTimeout" || gps.error === "gpsUnavailable") ? t("gpsEnableHint")
                : undefined
              }
              onDismiss={gps.clearError}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
