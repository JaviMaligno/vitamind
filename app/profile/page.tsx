"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";
import { TARGET_IU_PRESETS, maxSessionIU } from "@/lib/vitd";
import CitySearch from "@/components/CitySearch";
import SkinSelector from "@/components/SkinSelector";
import NotificationToggle from "@/components/NotificationToggle";
import SaveLocationModal from "@/components/SaveLocationModal";

export default function ProfilePage() {
  const t = useTranslations("config");
  const tc = useTranslations("common");
  const ts = useTranslations("skin");
  const app = useApp();

  const [savingLocation, setSavingLocation] = useState(false);

  return (
    <div className="mx-auto max-w-[960px] px-4 space-y-6">
      {/* Search city */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-text-faint font-semibold mb-3">
          {t("searchCity")}
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <CitySearch
            onSelect={app.selectCity}
            onAddFav={app.toggleFav}
            favorites={app.favorites}
            allCities={app.allCities}
          />
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] text-text-faint">{tc("lat")}</span>
            <input
              value={app.lat}
              onChange={(e) => {
                app.setLat(parseFloat(e.target.value) || 0);
                app.setCityName(`${e.target.value}°`);
                app.setCityFlag("📍");
              }}
              className="w-16 px-2 py-1.5 rounded-lg bg-surface-input border border-border-default text-text-primary text-[11px] font-mono outline-none"
            />
            <span className="text-[9px] text-text-faint">{tc("lon")}</span>
            <input
              value={app.lon}
              onChange={(e) => {
                app.setLon(parseFloat(e.target.value) || 0);
                app.setTz(
                  Math.round((parseFloat(e.target.value) || 0) / 15),
                );
              }}
              className="w-16 px-2 py-1.5 rounded-lg bg-surface-input border border-border-default text-text-primary text-[11px] font-mono outline-none"
            />
          </div>
        </div>
        {/* Actions row */}
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          {!app.isCurrentFav && app.cityName && (
            <button
              onClick={() => app.toggleFav(app.cityId)}
              className="min-h-[44px] px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-semibold cursor-pointer"
            >
              {tc("favorite")}
            </button>
          )}
          <button
            onClick={() => setSavingLocation(true)}
            className="min-h-[44px] px-3 py-1 rounded-full bg-surface-elevated text-text-muted text-[10px] cursor-pointer"
          >
            {tc("saveAs")}
          </button>
        </div>
        {savingLocation && (
          <div className="mt-3">
            <SaveLocationModal
              lat={app.lat}
              lon={app.lon}
              cityName={app.cityName}
              cityFlag={app.cityFlag}
              onSave={(city) => {
                app.handleSaveLocation(city);
                setSavingLocation(false);
              }}
              onCancel={() => setSavingLocation(false)}
            />
          </div>
        )}
      </section>

      {/* Favorites */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-text-faint font-semibold mb-3">
          {t("favorites")}
        </h3>
        <div className="flex flex-wrap gap-1 items-center">
          {app.favorites.map((fid) => {
            const c = app.allCities.find((x) => x.id === fid);
            if (!c) return null;
            const isSel = app.cityId === fid;
            return (
              <div key={fid} className="flex items-center">
                <button
                  onClick={() => app.selectCity(c)}
                  className={`min-h-[44px] px-2.5 py-1 text-[10px] cursor-pointer ${
                    app.editingFavs
                      ? "rounded-l-xl"
                      : "rounded-xl"
                  } ${
                    isSel
                      ? "bg-amber-400/[0.18] text-amber-400 font-semibold"
                      : "bg-surface-card text-text-muted"
                  }`}
                >
                  {c.flag} {c.name}
                </button>
                {app.editingFavs && (
                  <button
                    onClick={() => {
                      app.toggleFav(fid);
                      if (c.source === "custom") app.handleDeleteCustom(fid);
                    }}
                    className="min-h-[44px] px-1.5 py-1 rounded-r-xl bg-red-500/10 text-red-400 text-[9px] cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => app.setEditingFavs(!app.editingFavs)}
            className={`min-h-[44px] px-2.5 py-1 rounded-xl text-[9px] cursor-pointer ${
              app.editingFavs
                ? "bg-amber-400/10 text-amber-400"
                : "bg-surface-card text-text-faint"
            }`}
          >
            {app.editingFavs ? t("done") : t("edit")}
          </button>
        </div>
      </section>

      {/* Solar profile */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-text-faint font-semibold mb-3">
          {t("solarProfile")}
        </h3>
        <SkinSelector
          skinType={app.skinType}
          areaFraction={app.areaFraction}
          age={app.age}
          onSkinChange={app.setSkinType}
          onAreaChange={app.setAreaFraction}
          onAgeChange={app.setAge}
        />
      </section>

      {/* Threshold */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-text-faint font-semibold mb-3">
          {t("threshold")}
        </h3>
        <div className="flex gap-1.5">
          {[45, 50].map((th) => (
            <button
              key={th}
              onClick={() => app.setThreshold(th)}
              className={`min-h-[44px] px-3 py-1.5 rounded-md font-mono text-[10px] cursor-pointer ${
                app.threshold === th
                  ? "bg-amber-400/15 text-amber-400 font-semibold"
                  : "bg-surface-card text-text-muted"
              }`}
            >
              {th}°
            </button>
          ))}
        </div>
      </section>

      {/* Target IU */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-text-faint font-semibold mb-3">
          {t("targetIU")}
        </h3>
        <div className="flex flex-wrap gap-1.5 items-center">
          {TARGET_IU_PRESETS.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => app.setTargetIU(value)}
              className={`min-h-[44px] px-3 py-1.5 rounded-md text-[10px] cursor-pointer ${
                app.targetIU === value
                  ? "bg-amber-400/15 text-amber-400 font-semibold"
                  : "bg-surface-card text-text-muted"
              }`}
            >
              <span className="font-mono">{value}</span> <span className="text-[9px]">{ts(labelKey)}</span>
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={100}
              max={10000}
              step={100}
              value={app.targetIU}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 100 && v <= 10000) app.setTargetIU(v);
              }}
              className="w-20 min-h-[44px] px-2 py-1.5 rounded-md bg-surface-input border border-border-default text-text-primary text-[11px] font-mono outline-none text-center"
            />
            <span className="text-[10px] text-text-muted">IU</span>
          </div>
        </div>
        <p className="text-[9px] text-text-faint mt-2 leading-relaxed">
          {ts("targetHint", { max: Math.round(maxSessionIU(app.areaFraction, app.age)) })}
        </p>
      </section>

      {/* Notifications */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-text-faint font-semibold mb-3">
          {t("notifications")}
        </h3>
        <NotificationToggle
          lat={app.lat}
          lon={app.lon}
          tz={app.tz}
          skinType={app.skinType}
          areaFraction={app.areaFraction}
          threshold={app.threshold}
          cityName={app.cityName}
        />
      </section>
    </div>
  );
}
