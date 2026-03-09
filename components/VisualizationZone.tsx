"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import WorldMap from "@/components/WorldMap";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import DailyCurve from "@/components/DailyCurve";
import VitDEstimate from "@/components/VitDEstimate";
import type { City, SolarPoint, WeatherData } from "@/lib/types";
import type { SkinType } from "@/lib/vitd";

type Tab = "curve" | "map" | "heatmap";

interface Props {
  lat: number;
  lon: number;
  doy: number;
  tz: number;
  threshold: number;
  cityName: string;
  cityFlag: string;
  dateLabel: string;
  curve: SolarPoint[];
  weather: WeatherData | null;
  skinType: SkinType;
  areaFraction: number;
  age: number | null;
  onSelectCity: (c: City) => void;
  onSelectFromHeatmap: (lat: number, doy: number) => void;
  favorites: string[];
  allCities: City[];
  scrubMode: boolean;
  onScrubModeToggle: () => void;
}

export default function VisualizationZone({
  lat,
  lon,
  doy,
  threshold,
  cityName,
  cityFlag,
  dateLabel,
  curve,
  weather,
  skinType,
  areaFraction,
  age,
  onSelectCity,
  onSelectFromHeatmap,
  favorites,
  allCities,
  scrubMode,
  onScrubModeToggle,
}: Props) {
  const [tab, setTab] = useState<Tab>("curve");
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const tTabs = useTranslations("tabs");
  const tViz = useTranslations("viz");

  const TABS: { key: Tab; label: string }[] = [
    { key: "curve", label: tTabs("dailyCurve") },
    { key: "map", label: tTabs("worldMap") },
    { key: "heatmap", label: tTabs("heatmap") },
  ];

  return (
    <section className="mx-auto max-w-[960px] px-4 py-2">
      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-t-lg text-xs font-medium transition-colors cursor-pointer border-b-2 ${
              tab === key
                ? "bg-white/[0.05] text-amber-400 border-amber-400 font-semibold"
                : "bg-transparent text-white/25 border-transparent hover:text-white/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Visualization content */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
        {tab === "curve" && (
          <>
            <div className="text-[10px] text-white/30 mb-1 pl-2">
              <strong className="text-white/45">{tViz("dailyCurveTitle")}</strong> ·{" "}
              {cityFlag} {cityName} · {dateLabel}
              {weather && (
                <span className="ml-2 text-white/20">
                  · {tViz("withWeatherData")}
                </span>
              )}
            </div>
            <DailyCurve
              curve={curve}
              threshold={threshold}
              hoverTime={hoverTime}
              onHover={setHoverTime}
              weather={weather}
            />
          </>
        )}

        {tab === "map" && (
          <>
            <div className="flex justify-end mb-1 pr-2">
              <button
                onClick={onScrubModeToggle}
                className={`px-3 py-1 rounded-md text-[9px] cursor-pointer ${
                  scrubMode
                    ? "bg-amber-400/15 text-amber-400 font-semibold"
                    : "bg-white/[0.04] text-white/30"
                }`}
              >
                {scrubMode ? tViz("explore") : tViz("move")}
              </button>
            </div>
            <WorldMap
              lat={lat}
              lon={lon}
              doy={doy}
              threshold={threshold}
              onSelect={onSelectCity}
              favorites={favorites}
              allCities={allCities}
              scrubMode={scrubMode}
            />
          </>
        )}

        {tab === "heatmap" && (
          <>
            <div className="text-[10px] text-white/30 mb-1 pl-2">
              <strong className="text-white/45">{tViz("heatmapTitle")}</strong> ·{" "}
              {tViz("heatmapDesc", { threshold })} ·{" "}
              <em>{tViz("heatmapHint")}</em>
            </div>
            <GlobalHeatmap
              selectedLat={lat}
              selectedDoy={doy}
              threshold={threshold}
              onSelect={onSelectFromHeatmap}
            />
          </>
        )}
      </div>

      {/* VitD Estimate — always visible below */}
      <div className="mt-3">
        <VitDEstimate
          weather={weather}
          curve={curve}
          skinType={skinType}
          areaFraction={areaFraction}
          age={age}
        />
      </div>
    </section>
  );
}
