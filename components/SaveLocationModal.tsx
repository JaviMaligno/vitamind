"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { City } from "@/lib/types";

interface Props {
  lat: number;
  lon: number;
  cityName: string;
  cityFlag: string;
  onSave: (city: City) => void;
  onCancel: () => void;
}

export default function SaveLocationModal({ lat, lon, cityName, cityFlag, onSave, onCancel }: Props) {
  const [name, setName] = useState(cityName || "");
  const [saved, setSaved] = useState(false);
  const t = useTranslations("common");

  const handleSave = () => {
    const finalName = name.trim() || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    onSave({
      id: `custom:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      lat,
      lon,
      tz: Math.round(lon / 15),
      flag: cityFlag || "\u{1F4CD}",
      source: "custom",
    });
    setSaved(true);
    setTimeout(onCancel, 1500);
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
        <span className="text-green-400 text-sm font-medium">
          ✓ {t("savedAs")} &quot;{name.trim() || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`}&quot;
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/20 bg-black/60 p-4 space-y-3">
      {/* Show what we're saving */}
      <div className="text-sm text-white/50">
        {t("savingLocation")} <span className="text-white/80">{cityFlag} {lat.toFixed(2)}°, {lon.toFixed(2)}°</span>
      </div>

      {/* Name input */}
      <div>
        <label className="text-xs text-white/30 block mb-1">{t("nameLabel")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm outline-none focus:border-amber-400/40"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="min-h-[44px] flex-1 px-4 py-2 rounded-lg bg-amber-400/20 text-amber-400 text-sm font-semibold cursor-pointer hover:bg-amber-400/30 transition-colors"
        >
          {t("saveAndFavorite")}
        </button>
        <button
          onClick={onCancel}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-white/[0.06] text-white/40 text-sm cursor-pointer hover:bg-white/[0.1] transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
