"use client";

import CitySearch from "@/components/CitySearch";
import type { City } from "@/lib/types";
import type { ExposureResult } from "@/lib/vitd";

interface Props {
  lat: number;
  lon: number;
  tz: number;
  doy: number;
  threshold: number;
  cityName: string;
  cityFlag: string;
  hasLocation: boolean;
  onSelectCity: (c: City) => void;
  onAddFav: (c: City | string) => void;
  favorites: string[];
  allCities: City[];
  exposure: ExposureResult | null;
  vitDHours: number;
  peakElevation: number;
  dateLabel: string;
  windowLabel: string | null;
  onRequestGps?: () => void;
  gpsLoading?: boolean;
  gpsError?: string | null;
}

export default function HeroZone({
  lat,
  lon,
  cityName,
  cityFlag,
  hasLocation,
  onSelectCity,
  onAddFav,
  favorites,
  allCities,
  exposure,
  vitDHours,
  peakElevation,
  dateLabel,
  windowLabel,
  onRequestGps,
  gpsLoading,
  gpsError,
}: Props) {
  if (!hasLocation) {
    return (
      <section className="mx-auto max-w-[960px] py-12 px-4 text-center">
        <h1 className="text-[36px] font-bold text-white mb-3">
          ¿Dónde estás?
        </h1>
        <p className="text-sm text-white/40 mb-6">
          Busca tu ciudad para saber si hoy puedes sintetizar vitamina D
        </p>

        {/* GPS button */}
        {onRequestGps && (
          <div className="mb-6">
            <button
              onClick={onRequestGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/90 hover:bg-amber-500 text-[#0a0e27] font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
              {gpsLoading ? "Localizando..." : "Usar mi ubicación"}
            </button>
            {gpsError && (
              <p className="mt-2 text-xs text-red-400/80">{gpsError}</p>
            )}
          </div>
        )}

        {/* City search as alternative */}
        <div className="mx-auto max-w-md">
          {onRequestGps && (
            <p className="text-xs text-white/30 mb-3">o busca una ciudad</p>
          )}
          <CitySearch
            onSelect={onSelectCity}
            onAddFav={onAddFav}
            favorites={favorites}
            allCities={allCities}
          />
        </div>
      </section>
    );
  }

  const canSynthesize = vitDHours > 0 && exposure !== null;
  const minutesNeeded = exposure ? Math.round(exposure.minutesNeeded) : null;
  const bestHour = exposure?.bestHour ?? null;

  return (
    <section className="mx-auto max-w-[960px] px-4 py-8">
      <div
        className={`rounded-2xl border p-6 md:p-8 shadow-lg ${
          canSynthesize
            ? "border-amber-400/15 bg-gradient-to-br from-amber-400/[0.06] to-orange-600/[0.03]"
            : "border-red-400/10 bg-gradient-to-br from-red-500/[0.06] to-red-900/[0.03]"
        }`}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              canSynthesize ? "bg-amber-400" : "bg-red-400"
            }`}
          />
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              canSynthesize ? "text-amber-400/70" : "text-red-400/70"
            }`}
          >
            {canSynthesize ? "Síntesis posible" : "Sin vitamina D hoy"}
          </span>
        </div>

        {canSynthesize ? (
          <>
            {/* Main answer */}
            <h2 className="text-[36px] md:text-[40px] font-bold text-white leading-tight mb-2">
              <span className="font-mono text-amber-400">
                {minutesNeeded}
              </span>{" "}
              minutos al sol
            </h2>
            <p className="text-sm text-white/40 mb-6">
              para sintetizar ~1000 UI de vitamina D
            </p>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {windowLabel && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/25 block mb-0.5">
                    Ventana UV
                  </span>
                  <span className="font-mono text-[15px] font-semibold text-amber-400">
                    {windowLabel}
                  </span>
                </div>
              )}
              {bestHour !== null && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-white/25 block mb-0.5">
                    Mejor hora
                  </span>
                  <span className="font-mono text-[15px] font-semibold text-white/80">
                    {String(bestHour).padStart(2, "0")}:00
                  </span>
                </div>
              )}
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/25 block mb-0.5">
                  Pico solar
                </span>
                <span className="font-mono text-[15px] font-semibold text-white/80">
                  {peakElevation.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/25 block mb-0.5">
                  Ubicación
                </span>
                <span className="text-[15px] text-white/60">
                  {cityFlag} {cityName}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/25 block mb-0.5">
                  Fecha
                </span>
                <span className="text-[15px] text-white/60">{dateLabel}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[32px] md:text-[36px] font-bold text-white leading-tight mb-2">
              Hoy no es posible sintetizar vitamina D
            </h2>
            <p className="text-sm text-white/40 mb-4">
              El sol no alcanza la elevación necesaria en{" "}
              <span className="text-white/60">
                {cityFlag} {cityName}
              </span>{" "}
              · {dateLabel}
            </p>
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 text-sm text-white/50 max-w-lg">
              <span className="text-amber-400/70 font-semibold">Consejo:</span>{" "}
              Considera suplementación oral de vitamina D (800-2000 UI/día)
              durante los meses con baja radiación UV.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
