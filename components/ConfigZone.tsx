"use client";

import { useState } from "react";
import CitySearch from "@/components/CitySearch";
import SkinSelector from "@/components/SkinSelector";
import NotificationToggle from "@/components/NotificationToggle";
import SaveLocationModal from "@/components/SaveLocationModal";
import type { City } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";
import { fmtDate } from "@/lib/solar";

interface Props {
  // Location
  lat: number;
  lon: number;
  tz: number;
  cityName: string;
  cityId: string;
  setLat: (v: number) => void;
  setLon: (v: number) => void;
  setTz: (v: number) => void;
  setCityName: (v: string) => void;
  setCityFlag: (v: string) => void;
  onSelectCity: (c: City) => void;
  onAddFav: (c: City | string) => void;
  // Favorites
  favorites: string[];
  allCities: City[];
  cityFlag: string;
  editingFavs: boolean;
  setEditingFavs: (v: boolean) => void;
  toggleFav: (c: City | string) => void;
  handleDeleteCustom: (id: string) => void;
  isCurrentFav: boolean;
  // Save location
  onSaveLocation: (city: City) => void;
  // Skin
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  onSkinChange: (v: SkinType) => void;
  onAreaChange: (v: number) => void;
  onAgeChange: (v: number | null) => void;
  // Date
  doy: number;
  setDoy: (v: number | ((d: number) => number)) => void;
  date: Date;
  animating: boolean;
  toggleAnim: () => void;
  // Threshold
  threshold: number;
  setThreshold: (v: number) => void;
  // Notifications
  notificationProps: {
    lat: number;
    lon: number;
    tz: number;
    skinType: SkinType;
    areaFraction: number;
    threshold: number;
    cityName: string;
  };
}

export default function ConfigZone({
  lat,
  lon,
  setLat,
  setLon,
  setTz,
  setCityName,
  setCityFlag,
  onSelectCity,
  onAddFav,
  favorites,
  allCities,
  cityId,
  editingFavs,
  setEditingFavs,
  toggleFav,
  handleDeleteCustom,
  isCurrentFav,
  cityFlag,
  cityName,
  onSaveLocation,
  skinType,
  areaFraction,
  age,
  onSkinChange,
  onAreaChange,
  onAgeChange,
  doy,
  setDoy,
  date,
  animating,
  toggleAnim,
  threshold,
  setThreshold,
  notificationProps,
}: Props) {
  const [open, setOpen] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  return (
    <section className="mx-auto max-w-[960px] px-4 pt-6 pb-2">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer mb-3"
      >
        <span
          className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span className="uppercase tracking-wider font-semibold text-[11px]">
          Configuración
        </span>
      </button>

      {open && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-6">
          {/* Search city */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-white/25 font-semibold mb-3">
              Buscar ciudad
            </h3>
            <div className="flex flex-wrap gap-3 items-center">
              <CitySearch
                onSelect={onSelectCity}
                onAddFav={onAddFav}
                favorites={favorites}
                allCities={allCities}
              />
              <div className="flex gap-1.5 items-center">
                <span className="text-[9px] text-white/20">Lat</span>
                <input
                  value={lat}
                  onChange={(e) => {
                    setLat(parseFloat(e.target.value) || 0);
                    setCityName(`${e.target.value}°`);
                    setCityFlag("📍");
                  }}
                  className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.07] border border-white/10 text-white/80 text-[11px] font-mono outline-none"
                />
                <span className="text-[9px] text-white/20">Lon</span>
                <input
                  value={lon}
                  onChange={(e) => {
                    setLon(parseFloat(e.target.value) || 0);
                    setTz(
                      Math.round((parseFloat(e.target.value) || 0) / 15),
                    );
                  }}
                  className="w-16 px-2 py-1.5 rounded-lg bg-white/[0.07] border border-white/10 text-white/80 text-[11px] font-mono outline-none"
                />
              </div>
            </div>
            {/* Actions row */}
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              {!isCurrentFav && cityName && (
                <button
                  onClick={() => toggleFav(cityId)}
                  className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-semibold cursor-pointer"
                >
                  ☆ Favorito
                </button>
              )}
              <button
                onClick={() => setSavingLocation(true)}
                className="px-3 py-1 rounded-full bg-white/[0.06] text-white/40 text-[10px] cursor-pointer"
              >
                Guardar como...
              </button>
            </div>
            {savingLocation && (
              <div className="mt-3">
                <SaveLocationModal
                  lat={lat}
                  lon={lon}
                  onSave={(city) => {
                    onSaveLocation(city);
                    setSavingLocation(false);
                  }}
                  onCancel={() => setSavingLocation(false)}
                />
              </div>
            )}
          </div>

          {/* Favorites */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-white/25 font-semibold mb-3">
              Favoritos
            </h3>
            <div className="flex flex-wrap gap-1 items-center">
              {favorites.map((fid) => {
                const c = allCities.find((x) => x.id === fid);
                if (!c) return null;
                const isSel = cityId === fid;
                return (
                  <div key={fid} className="flex items-center">
                    <button
                      onClick={() => onSelectCity(c)}
                      className={`px-2.5 py-1 text-[10px] cursor-pointer ${
                        editingFavs
                          ? "rounded-l-xl"
                          : "rounded-xl"
                      } ${
                        isSel
                          ? "bg-amber-400/[0.18] text-amber-400 font-semibold"
                          : "bg-white/[0.04] text-white/35"
                      }`}
                    >
                      {c.flag} {c.name}
                    </button>
                    {editingFavs && (
                      <button
                        onClick={() => {
                          toggleFav(fid);
                          if (c.source === "custom") handleDeleteCustom(fid);
                        }}
                        className="px-1.5 py-1 rounded-r-xl bg-red-500/10 text-red-400 text-[9px] cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setEditingFavs(!editingFavs)}
                className={`px-2.5 py-1 rounded-xl text-[9px] cursor-pointer ${
                  editingFavs
                    ? "bg-amber-400/10 text-amber-400"
                    : "bg-white/[0.04] text-white/20"
                }`}
              >
                {editingFavs ? "✓ Listo" : "✎ Editar"}
              </button>
            </div>
          </div>

          {/* Solar profile */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-white/25 font-semibold mb-3">
              Perfil solar
            </h3>
            <SkinSelector
              skinType={skinType}
              areaFraction={areaFraction}
              age={age}
              onSkinChange={onSkinChange}
              onAreaChange={onAreaChange}
              onAgeChange={onAgeChange}
            />
          </div>

          {/* Date controls */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-white/25 font-semibold mb-3">
              Fecha
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDoy((d: number) => Math.max(1, d - 1))}
                className="px-2 py-1.5 rounded-md bg-white/[0.06] text-white/80 cursor-pointer text-[10px]"
              >
                ◀
              </button>
              <input
                type="range"
                min="1"
                max="365"
                value={doy}
                onChange={(e) => setDoy(parseInt(e.target.value))}
                className="flex-1 min-w-[140px] h-1 accent-amber-400"
              />
              <button
                onClick={() => setDoy((d: number) => Math.min(365, d + 1))}
                className="px-2 py-1.5 rounded-md bg-white/[0.06] text-white/80 cursor-pointer text-[10px]"
              >
                ▶
              </button>
              <span className="font-mono text-[11px] text-amber-400 min-w-[50px]">
                {fmtDate(date)}
              </span>
              <button
                onClick={toggleAnim}
                className={`px-3 py-1.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                  animating
                    ? "bg-red-500/15 text-red-400"
                    : "bg-amber-400/10 text-amber-400"
                }`}
              >
                {animating ? "⏸" : "▶ Animar"}
              </button>
            </div>
          </div>

          {/* Threshold */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-white/25 font-semibold mb-3">
              Umbral solar
            </h3>
            <div className="flex gap-1.5">
              {[45, 50].map((t) => (
                <button
                  key={t}
                  onClick={() => setThreshold(t)}
                  className={`px-3 py-1.5 rounded-md font-mono text-[10px] cursor-pointer ${
                    threshold === t
                      ? "bg-amber-400/15 text-amber-400 font-semibold"
                      : "bg-white/[0.04] text-white/35"
                  }`}
                >
                  {t}°
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-white/25 font-semibold mb-3">
              Notificaciones
            </h3>
            <NotificationToggle {...notificationProps} />
          </div>
        </div>
      )}
    </section>
  );
}
