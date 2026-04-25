"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import GpsErrorHint from "@/components/GpsErrorHint";

export default function GpsButton() {
  const t = useTranslations("hero");
  const app = useApp();
  const { gps, cityId, hasLocation } = app;

  if (!hasLocation) return null;

  const isActive = cityId.startsWith("gps:");
  const isDenied = gps.error === "gpsDenied";

  const iconColor = gps.loading
    ? "text-text-muted"
    : isActive
      ? "text-emerald-400"
      : isDenied
        ? "text-red-400"
        : "text-amber-400";

  const bgColor = gps.loading
    ? "bg-surface-card"
    : isActive
      ? "bg-emerald-400/10 hover:bg-emerald-400/20"
      : isDenied
        ? "bg-red-400/10 hover:bg-red-400/20"
        : "bg-surface-card hover:bg-surface-elevated";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={gps.enableGps}
        disabled={gps.loading}
        title={t("useMyLocation")}
        aria-label={t("useMyLocation")}
        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${bgColor}`}
      >
        {gps.loading ? (
          <svg
            className={`w-4 h-4 animate-spin ${iconColor}`}
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
            className={`w-4 h-4 ${iconColor}`}
          >
            <path
              fillRule="evenodd"
              d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      {gps.slow && !gps.error && (
        <p className="text-[10px] text-amber-400/60 max-w-[180px] leading-tight animate-pulse">
          {t("gpsEnableHint")}
        </p>
      )}
      {gps.error && (
        <GpsErrorHint
          error={t(gps.error)}
          hint={
            isDenied ? t("gpsDeniedHint")
            : (gps.error === "gpsTimeout" || gps.error === "gpsUnavailable") ? t("gpsEnableHint")
            : undefined
          }
        />
      )}
    </div>
  );
}
